# Module: Archive Submission (Admin) — Brief

Dokumen ini mencatat bagian **sisi ADMIN** modul Archive Submission pada frontend React: **API + hooks** untuk list usulan arsip masuk + flow approve/reject, **dikonsumsi oleh container dashboard** (`src/app/routes/dashboard-home.tsx`). Mengikuti konvensi `frontend/AGENTS.md` dan meniru persis brief analog `docs/module/event-submission.md`.

**Tujuan fitur**: consumer eksternal (website/pihak di luar EGS) mengirim usulan arsip lewat **API publik** backend → admin meninjau di **section dashboard** → usulan yang **di-approve direcreate backend menjadi row `Archive` berstatus `DRAFT`** → admin **diarahkan ke editor `/archives/:id/edit`** untuk mengedit, lalu **publish langsung** (alur publish existing, permission `archive:publish`) agar tayang. **Reject = tidak dipindahkan** (usulan ditolak, tidak ada `Archive` dibuat).

> **Status**: 🚧 **RENCANA — belum ada kode**. Belum ada file `src/features/archive-submission/` maupun i18n yang dibuat.
>
> **Tidak ada route, tidak ada halaman, tidak ada menu sidebar khusus.** FE ini **tidak** punya route/halaman list submission. Seluruh pengelolaan submission (list + approve/reject) adalah **section di dashboard admin** — satu-satunya permukaan UI — lihat `docs/module/dashboard.md` §10i. Modul ini hanya menyediakan **API + hooks** yang dipanggil container dashboard.
>
> **Create TIDAK punya UI di repo ini.** Endpoint `POST /archive-submissions` (publik) hanya **API backend** yang dikonsumsi **website/consumer eksternal** di luar FE ini. **Tidak ada halaman create, upload thumbnail publik, maupun hook create/upload di FE ini.** Kontrak create tetap final sebagai API publik backend — rujuk `backend/docs/modules/archive-submission.md`. Keputusan ini **mirror** `event-submission` (lihat `docs/module/event-submission.md`).

## 1. Ruang Lingkup

**Termasuk (sisi admin):**

- API + hooks untuk **list** usulan arsip masuk (search/sort/pagination server-side).
- API + hooks aksi **Setujui** (approve) → backend recreate `Archive` `DRAFT` → hook call-site dashboard redirect ke `/archives/:id/edit`.
- API + hooks aksi **Tolak** (reject) → usulan ditolak.
- Semua **dikonsumsi oleh section dashboard** (`dashboard.md` §10i — kolom **Publik** section **Arsip**).

**Tidak termasuk (tidak ada di FE ini):**

- Route/halaman/menu sidebar untuk submission — **tidak ada**; semua di dashboard.
- Halaman publik untuk mengirim usulan arsip, form submission, upload thumbnail publik.
- `hooks/use-create-archive-submission.ts`, `hooks/use-upload-archive-submission-thumbnail.ts`, `components/archive-submission-form.tsx`, schema form.
- Komponen tabel/page milik submission (`archive-submission-table.tsx`, container `app/routes/`): **tidak dibuat** — presentational baris ada di `features/dashboard/components/dashboard-pending-archive-submissions.tsx` (`dashboard.md` §10i).

## 2. Routing & Permukaan UI

- **Tidak ada route** dan **tidak ada halaman** di `src/app/routes/`. **Tidak ada entri sidebar.**
- Tidak ada `RequirePermission code="archive-submission:read"` di level route (tidak ada route yang di-gate).
- Gate dipindah **di dashboard** (`dashboard.md` §10i): query/aksi di-gate via `can('archive-submission:read'/'approve'/'reject')` dari `useAuthPermissions()`.
- Render section: `dashboard-home.tsx` merender komponen `DashboardPendingArchiveSubmissions` di dalam kolom **Publik** section **Arsip** (`dashboard.md` §10i) bila `canReadArchiveSubmissions = can('archive-submission:read')`. Kolom **Publik** yang saat ini masih **placeholder** kotak dashed (`section.pendingArchives.publicEmpty`) **digantikan** oleh list + pagination ini.
- Permukaan UI = section di dashboard admin; modul ini hanya menyediakan **API + hooks**.

## 3. Struktur Folder

```
src/features/archive-submission/
├── api/
│   └── archive-submissions.ts              # listArchiveSubmissions, approveArchiveSubmission, rejectArchiveSubmission
├── hooks/
│   ├── use-archive-submissions.ts          # query ['archive-submissions', {...}] + keepPreviousData
│   ├── use-approve-archive-submission.ts   # invalidate ['archive-submissions'] + ['archive']
│   └── use-reject-archive-submission.ts    # invalidate ['archive-submissions'] + ['archive']
└── types.ts                                # ArchiveSubmission, ApproveArchiveSubmissionResult, dll.
```

- **Konsumen**: container `src/app/routes/dashboard-home.tsx` (page boleh import hook lintas domain; komponen di `features/dashboard/` tetap presentational).
- Komponen shared dipakai ulang (tidak dibuat baru): `components/shared/search-bar.tsx` *(bila search diaktifkan di section)*, `ui/alert-dialog`, `ui/badge`, `ui/button`, `ui/skeleton`.
- **Tidak ada** `src/app/routes/archive-submissions.tsx` maupun `features/archive-submission/components/`.
- **Tidak ada** `api/geo.ts`, `api/categories.ts`, `hooks/use-countries.ts`, `hooks/use-categories.ts`, `hooks/use-create-archive-submission.ts`, `hooks/use-upload-archive-submission-thumbnail.ts`, `components/archive-submission-form.tsx`, `components/archive-submission-table.tsx`, `lib/schema.ts`.

## 4. Kontrak API (Admin)

Prefix global `/api/v1`. Envelope: sukses `{ data, message }`; list `{ data, message, meta: { page, limit, total } }`; error `{ statusCode, message, errors }`. Unwrap sekali di `lib/api-client.ts` (`request`/`requestList`). Semua endpoint di bawah butuh JWT Bearer + permission admin.

| Metode | Endpoint | Body/Param | Keterangan |
| --- | --- | --- | --- |
| GET | `/archive-submissions?page=&limit=&search=&sortBy=&sortOrder=&filter[status]=` | `search` (kolom `searchable`), `sortBy` whitelist backend, `filter[status]` (`REQUEST`/`APPROVED`/`REJECTED`) | list usulan (meta `{page,limit,total}`) |
| POST | `/archive-submissions/:id/approve` | body opsional `{ adminNote? }` | 200; backend recreate konten submission → row `Archive` `status=DRAFT`; respons `{ submission, archive: { id, status: 'DRAFT' } }` |
| POST | `/archive-submissions/:id/reject` | body `{ adminNote? }` | 200; usulan ditolak, **tidak** membuat `Archive` |

> **`POST /archive-submissions` (create, publik) bukan milik FE ini** — dikonsumsi consumer eksternal. Kontrak create adalah **API publik backend**; rujuk `backend/docs/modules/archive-submission.md`. FE ini **tidak** memanggilnya.
>
> **`Archive` hasil recreate TIDAK punya `slug`** (berbeda dari `Event`). Navigasi edit memakai `archive.id`.

Tipe (`types.ts`, rencana):

```typescript
export type ArchiveSubmissionStatus = 'REQUEST' | 'APPROVED' | 'REJECTED'

export interface ArchiveSubmission {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  externalLinks: string[]
  attachmentCount: number   // jumlah lampiran PDF (server-derived; tanpa hidrasi detail)
  status: 'REQUEST' | 'APPROVED' | 'REJECTED'
  adminNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  archiveId: string | null
  createdAt: string
  updatedAt: string
}

export interface ApproveArchiveSubmissionResult {
  submission: ArchiveSubmission
  archive: { id: string; status: 'DRAFT' }
}
```

`api/archive-submissions.ts` meniru `features/event-submission/api/event-submissions.ts`: `listArchiveSubmissions` (`requestList` + `appendListParams` + `filter[key]`), `approveArchiveSubmission(id)` (`POST`, `request`), `rejectArchiveSubmission(id)` (`POST`, `request`).

## 5. List — Search / Sort / Pagination (dikonsumsi dashboard)

State paginasi (`page`/`search`/`sortBy`/`sortOrder`/`filter[status]`) dipegang **container dashboard** (`dashboard-home.tsx`); hook meneruskan ke API + queryKey (pola `docs/module/user.md`).

- **Kolom searchable backend**: `name`, `description`.
- **Kolom tampil** (baris dashboard): `name`, `description`/`externalLinks`, `attachmentCount`, `status`, `createdAt`. `attachmentCount` ditampilkan sebagai ikon `Paperclip` (lucide) + angka; nilai `0` → sembunyikan atau `—` (ikut design system). **Tanpa** organiser (tidak ada di kontrak ini).
- **Sortable (whitelist `sortBy` backend)**: `name`, `status`, `createdAt`, `updatedAt`. Bila dipakai di section, header di luar whitelist dirender biasa agar tidak memicu 422 `assertAllowedSort`.
- **Pagination** server-side: `limit=5`, pola `dashboard.md` §10g (`DataTablePagination`, `placeholderData: keepPreviousData`).
- **Search opsional dalam section**: bila diaktifkan, ikut pola `dashboard.md` §10g (SearchBar, debounce, `trim ≥ 2`, ubah search → `setPage(1)`); backend `searchable` `name`/`description`.
- **Query key**: `['archive-submissions', { page, limit, search, sortBy, sortOrder, filter }]` (pola `use-event-submissions.ts`).
- **Toast**: namespace `dashboard`, key `pendingArchiveSubmission.*` (bukan `archive:*`).
- Contoh query: `/archive-submissions?page=1&limit=5&filter[status]=REQUEST`.
- **State 403** (`isForbiddenError`) → empty-state differentiated dari 401 (`section.pendingArchiveSubmissions.error`), sedangkan 401 redirect login di `lib/api-client.ts`.

## 6. Aksi: Approve / Reject (call-site dashboard)

- **Approve** (gate `can('archive-submission:approve')`): klik **Setujui** → `AlertDialog` konfirmasi → `approveArchiveSubmission.mutate(id, …)` → `POST /archive-submissions/:id/approve`. Sukses: `toastSuccess(t('dashboard:pendingArchiveSubmission.approved'))` + **`navigate('/archives/' + res.archive.id + '/edit')`** (backend mengembalikan `{ submission, archive: { id, status: 'DRAFT' } }`) agar admin mengedit draft sebelum publish. **`Archive` tidak punya `slug`** — jangan meniru pola `/events/:slug`.
- **Reject** (gate `can('archive-submission:reject')`): klik **Tolak** → `AlertDialog` konfirmasi → `rejectArchiveSubmission.mutate(id, …)` → `POST /archive-submissions/:id/reject`. Sukses: `toastSuccess(t('dashboard:pendingArchiveSubmission.rejected'))`; **tidak** navigasi.
- **Invalidate** otomatis di hook: `['archive-submissions']` + `['archive']`.
- **Error**: non-422 → `toastError(getApiErrorMessage(err, t('dashboard:pendingArchiveSubmission.approveFailed'|'rejectFailed')))`; 422 early-return `if (isValidationError(err)) return;` (dialog tetap terbuka).

```tsx
// dashboard-home.tsx (rencana) — call-site
approveArchiveSubmission.mutate(submission.id, {
  onSuccess: (res) => {
    setApproveArchiveSubmissionId(null)
    toastSuccess(t('dashboard:pendingArchiveSubmission.approved'))
    navigate(`/archives/${res.archive.id}/edit`)
  },
  onError: (err: unknown) => {
    if (isValidationError(err)) return
    toastError(getApiErrorMessage(err, t('dashboard:pendingArchiveSubmission.approveFailed')))
  },
})
```

**Setelah approve**: `Archive` `DRAFT` diedit di `/archives/:id/edit` (modul `archive`) lalu di-publish lewat alur publish existing (`archive:publish`) — **tanpa** `archive:submit`/`REQUEST`. Tercatat juga di `docs/module/archive.md`.

## 7. Permissions

Tabel ini **hanya sisi admin**. Tidak ada permission create. **Tidak ada gate di level route** (tidak ada route) — gate query/aksi di dashboard.

| Aksi (di dashboard) | Kode | Dipakai |
| --- | --- | --- |
| Query list + render section | `archive-submission:read` | `can('archive-submission:read')` → `canReadArchiveSubmissions` |
| Tombol Setujui + `POST /archive-submissions/:id/approve` | `archive-submission:approve` | `can('archive-submission:approve')` |
| Tombol Tolak + `POST /archive-submissions/:id/reject` | `archive-submission:reject` | `can('archive-submission:reject')` |

- Gate via `can()` dari `useAuthPermissions()` di `dashboard-home.tsx`; komponen presentational menerima `canApprove`/`canReject` sebagai props.
- Backend men-seed tepat 3 permission di atas. **Tidak ada** permission create.

## 8. i18n

- **Tanpa namespace `archive-submission` sendiri.** Semua key ditaruh di namespace **`dashboard`** (`src/i18n/locales/{en,id}/dashboard.json`), dipakai oleh section dashboard.
- Struktur key (namespace `dashboard`; mirror persis key `event-submission`/`pendingSubmission.*`, label disesuaikan ke arsip — `name` bukan `title`, tanpa organiser):

  - `section.pendingArchiveSubmissions.{title,subtitle,empty,error}` — judul/subtitle section + empty/error state.
  - `pendingArchiveSubmission.{approve,reject,unknown,statusRequest}` — label tombol + fallback + badge "Diajukan".
  - `pendingArchiveSubmission.attachments` — label lampiran PDF, mis. `"{{count}} lampiran"` / dipakai sebagai `aria-label` ikon `Paperclip`.
  - `pendingArchiveSubmission.{approved,rejected,approveFailed,rejectFailed}` — toast call-site.
  - `pendingArchiveSubmission.confirm{Approve,Reject}{Title,Description}`, `pendingArchiveSubmission.confirm{Cancel,Submit}` — isi `AlertDialog`.
  - `section.pendingArchiveSubmissions.*` juga dipakai sebagai `entityName` pagination.

- **Tidak ada** key namespace `archive-submission` maupun key `archive-submission:admin.*` (semuanya di namespace `dashboard`).

## 9. Desain

Mengikuti `docs/DESIGN_SYSTEM.md` (token, tanpa hardcode warna/radius; `cn()` dari `@/lib/utils`). Presentational baris section ada di `features/dashboard/components/dashboard-pending-archive-submissions.tsx`.

- **Komponen baru**: `features/dashboard/components/dashboard-pending-archive-submissions.tsx` — presentational murni (hanya `components/ui`, `components/shared`, `lib`, `i18n`; **tanpa import lintas domain** `features/archive-submission`).
  - Props (exported `interface`), mirror `DashboardPendingSubmissionsProps`: `items: DashboardPendingArchiveSubmissionItem[]`, `isPending`, `isError`, `canApprove`, `canReject`, `isRefreshing?`, `onApprove(id)`, `onReject(id)`, `busyId?`, `className?`.
  - Baris: **reuse `ApprovalMediaCard`** (pola `dashboard-pending-submissions.tsx` — thumbnail + `ImageOff`, nama, metadata `CalendarDays` tanggal, badge "Diajukan") **atau** gaya baris ringkas `Card` `dashboard-pending-archives.tsx`. Loading → `Skeleton`; kosong → `section.pendingArchiveSubmissions.empty`; error → `section.pendingArchiveSubmissions.error` (muted). **Tanpa** tombol "Lihat detail" (tidak ada halaman detail submission).
  - **Lampiran**: baris boleh menampilkan `attachmentCount` (ikon lucide `Paperclip` + angka, `aria-label` dari i18n `pendingArchiveSubmission.attachments`; `0` → sembunyikan/`—`). **Tidak ada** tombol unduh/preview lampiran di dashboard — tidak ada endpoint list lampiran publik; lampiran dikelola admin di editor `/archives/:id/edit` setelah approve.
- View type `DashboardPendingArchiveSubmissionItem` ditambahkan ke `features/dashboard/types.ts` (dashboard tetap bebas import lintas domain): `id`, `name`, `thumbnail`, `description`, `externalLinks`, `attachmentCount`, `dateLabel` (dari `createdAt` via `formatDateTime`).
- **Wajib komponen shadcn** (bila belum ada): `alert-dialog`, `badge`, `skeleton` — verifikasi keberadaan di `src/components/ui/` sebelum `pnpm dlx shadcn@latest add`.
- **Aksesibel**: tombol ikon-only wajib `aria-label`; `AlertDialog` untuk konfirmasi destructive; tombol aksi `disabled` saat `busyId`/`isRefreshing` + `aria-busy`.

## 10. Verifikasi (Rencana)

Belum dapat dijalankan — belum ada kode. Saat implementasi:

- `pnpm lint` → 0 error baru.
- `pnpm exec tsc -p tsconfig.app.json --noEmit` → 0 error baru di file `archive-submission*` (catatan: `pnpm tsc --noEmit` **no-op** karena `tsconfig.json` `files: []`).
- `pnpm dev` → **tidak ada** akses route/halaman/menu submission; section hanya tampil bila `can('archive-submission:read')`; pagination server-side `limit=5`.
- Cek manual: **Setujui** → `AlertDialog` → toast + `navigate('/archives/<archive.id>/edit')`; **Tolak** → `AlertDialog` → toast + list invalidate (tanpa navigasi); tombol digate `can('archive-submission:approve'/'reject')`; invalidate `['archive-submissions']` + `['archive']`.
- Pastikan **tidak ada** panggilan create/upload dari FE, dan **tidak ada** string route/halaman `/archive-submissions`, `ArchiveSubmissionsPage`, `archive-submission-table`.

## 11. Catatan

- **Status RENCANA**: seluruh isi §1–§11 adalah rencana; **belum ada file dibuat**. Backend `archive-submission` dibangun paralel — rujuk `backend/docs/modules/archive-submission.md`.
- **Bedakan dari workflow `archive` INTERNAL (JANGAN dicampur)**: resource `archive` **sudah punya** workflow submit/approve/reject internal untuk user terautentikasi (`archive:submit`, section `dashboard-pending-archives.tsx`, endpoint `/archives`, `POST /archives/:id/{submit,approve,reject}`) — lihat `docs/module/archive.md` §8 & `dashboard.md` §10f. Modul **ini** adalah **jalur submission PUBLIK yang TERPISAH**: tabel `archive-submission` sendiri, section `dashboard-pending-archive-submissions.tsx` sendiri, endpoint `/archive-submissions` sendiri. **Jangan menyatukan** hooks/types/i18n keduanya; `use-archive-submissions` ≠ `use-archives`.
- **Tanpa route/halaman**: tidak ada route, halaman, menu sidebar, `ArchiveSubmissionsPage`, atau `archive-submission-table` untuk submission. Satu-satunya UI pengelolaan = section dashboard (`dashboard.md` §10i). Endpoint `/archive-submissions` tetap dipakai sebagai **API**.
- **Create = API publik backend, bukan FE ini**: `POST /archive-submissions` dikonsumsi website/consumer eksternal. Tidak ada halaman/form/upload di repo FE ini. **Field minimal** submission kini mencakup **lampiran PDF** — dikirim lewat `POST /archive-submissions/attachments` (publik, dieksekusi konsumen eksternal, **bukan** FE ini); FE admin hanya membaca `attachmentCount` hasil turunan server. Yang masih ditunda: `categoryIds` + identitas submitter.
- **Lampiran PDF**: submission publik boleh melampirkan PDF via `POST /archive-submissions/attachments` (publik). Server menurunkan `attachmentCount` pada item list (detail, bila dikonsumsi, menghidrasi `attachments: DocumentResponse[]`, tetapi FE ini hanya konsumsi list — tanpa hidrasi detail, tanpa UI unggah). Saat **approve**, backend **menyalin lampiran ke documents `Archive`** (server-side); admin mengelolanya di editor `/archives/:id/edit` setelah approve. **Tidak ada** tombol unduh/preview lampiran di dashboard.
- **Detail lampiran tidak dikonsumsi FE**: tidak ada endpoint list lampiran publik, tidak ada hook/UI unduh/preview di dashboard; pengelolaan lampiran sepenuhnya di editor `/archives/:id/edit` (modul `archive`).
- **Hasil approve = `Archive` `DRAFT`**: submission yang di-approve **direcreate backend** menjadi row `Archive` `DRAFT`; admin diarahkan ke `/archives/:id/edit` (pakai `archive.id` dari respons approve) lalu publish via `archive:publish`. Approval **melewati** `archive:submit`/`REQUEST`. **Reject** = tidak dipindahkan. **`Archive` tidak punya `slug`** — navigasi hanya dengan `id`.
- **Integrasi `dashboard.md` §10i**: komponen mengisi kolom **Publik** section **Arsip** yang saat ini masih placeholder `section.pendingArchives.publicEmpty`. Setelah modul ini, kolom itu merender list + `DataTablePagination` (`entityName` = judul kolom Publik / section). State `pendingArchiveSubmissionsPage` + clamp ditambahkan di `dashboard-home.tsx` mengikuti pola §10g.
- **Submission + dashboard admin**: setiap submission `REQUEST` tampil di section dashboard. `GET /archive-submissions` mendukung `filter[status]` (dipakai section dashboard, `limit=5`).
- **Bedakan dengan editor `/archives/*`**: `/archives/*` modul internal berguard (`archive:*`); endpoint submission memakai `/archive-submissions` (bukan `/archives`). Jangan campur hook/tipe.
