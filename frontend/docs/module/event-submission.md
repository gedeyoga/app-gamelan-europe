# Module: Event Submission (Admin) — Brief

Dokumen ini mencatat bagian **sisi ADMIN** modul Event Submission pada frontend React: **API + hooks** untuk list usulan masuk + flow approve/reject, **dikonsumsi oleh container dashboard** (`src/app/routes/dashboard-home.tsx`). Mengikuti konvensi `frontend/AGENTS.md`.

**Tujuan fitur**: consumer eksternal (website/pihak di luar EGS) mengirim usulan event lewat **API publik** backend → admin meninjau di **section dashboard** → usulan yang **di-approve direcreate backend menjadi row `Event` berstatus `DRAFT`** → admin **diarahkan ke editor `/events/:id/edit`** untuk mengedit, lalu **publish langsung** (alur publish existing, permission `event:publish`) agar tayang. **Reject = tidak dipindahkan** (usulan ditolak, tidak ada `Event` dibuat).

> **Status**: 🚧 **RENCANA — belum ada kode**. Belum ada file `src/features/event-submission/` maupun i18n yang dibuat.
>
> **Tidak ada route, tidak ada halaman, tidak ada menu sidebar khusus.** FE ini **tidak** punya route/halaman list submission. Seluruh pengelolaan submission (list + approve/reject) adalah **section di dashboard admin** — satu-satunya permukaan UI — lihat `docs/module/dashboard.md` §10h. Modul ini hanya menyediakan **API + hooks** yang dipanggil container dashboard.
>
> **Create TIDAK punya UI di repo ini.** Endpoint `POST /event-submissions` (publik) hanya **API backend** yang dikonsumsi **website/consumer eksternal** di luar FE ini. **Tidak ada halaman create, upload thumbnail publik, api geo/event-types, maupun hook create/upload di FE ini.** Kontrak create tetap final sebagai API publik backend — rujuk `backend/docs/modules/event-submission.md`.

## 1. Ruang Lingkup

**Termasuk (sisi admin):**

- API + hooks untuk **list** usulan event masuk (search/sort/pagination server-side).
- API + hooks aksi **Setujui** (approve) → backend recreate `Event` `DRAFT` → hook call-site dashboard redirect ke `/events/:id/edit`.
- API + hooks aksi **Tolak** (reject) → usulan ditolak.
- Semua **dikonsumsi oleh section dashboard** (§10h `dashboard.md`).

**Tidak termasuk (tidak ada di FE ini):**

- Route/halaman/menu sidebar untuk submission — **tidak ada**; semua di dashboard.
- Halaman publik untuk mengirim usulan event, form submission, upload thumbnail publik.
- `api/geo.ts`, `api/event-types.ts`, `hooks/use-countries.ts`, `hooks/use-states.ts`, `hooks/use-event-types.ts`.
- `hooks/use-create-event-submission.ts`, `hooks/use-upload-event-submission-thumbnail.ts`, `components/event-submission-form.tsx`, schema form.
- Komponen tabel/page milik submission (`event-submission-table.tsx`, container `app/routes/`): **tidak dibuat** — presentational baris ada di `features/dashboard/components/dashboard-pending-submissions.tsx` (§10h `dashboard.md`).

## 2. Routing & Permukaan UI

- **Tidak ada route** dan **tidak ada halaman** di `src/app/routes/`. **Tidak ada entri sidebar.**
- Tidak ada `RequirePermission code="event-submission:read"` di level route (tidak ada route yang di-gate).
- Gate dipindah **di dashboard** (§10h `dashboard.md`): query/aksi di-gate via `can('event-submission:read'/'approve'/'reject')` dari `useAuthPermissions()`.
- Render section: `dashboard-home.tsx` merender section "Pending Event Submissions" bila `canReadSubmissions = can('event-submission:read')`.

## 3. Struktur Folder

```
src/features/event-submission/
├── api/
│   └── event-submissions.ts           # listEventSubmissions, approveEventSubmission, rejectEventSubmission
├── hooks/
│   ├── use-event-submissions.ts       # query ['event-submissions', {page,limit,search,sortBy,sortOrder,filter}] + keepPreviousData
│   ├── use-approve-event-submission.ts# mutation POST /event-submissions/:id/approve → invalidate ['event-submissions'] + ['event']
│   └── use-reject-event-submission.ts # mutation POST /event-submissions/:id/reject  → invalidate ['event-submissions'] + ['event']
└── types.ts                           # EventSubmission, ApproveEventSubmissionResult, dll.
```

- **Konsumen**: container `src/app/routes/dashboard-home.tsx` (page boleh import hook lintas domain; komponen di `features/dashboard/` tetap presentational).
- Komponen shared dipakai ulang (tidak dibuat baru): `components/shared/search-bar.tsx` *(bila search diaktifkan di section)*, `ui/alert-dialog`, `ui/badge`, `ui/button`, `ui/skeleton`.
- **Tidak ada** `src/app/routes/event-submissions.tsx` maupun `features/event-submission/components/`.

**Dihapus dari fitur ini** (tidak dibuat): `api/geo.ts`, `api/event-types.ts`, `hooks/use-countries.ts`, `hooks/use-states.ts`, `hooks/use-event-types.ts`, `hooks/use-create-event-submission.ts`, `hooks/use-upload-event-submission-thumbnail.ts`, `components/event-submission-form.tsx`, `components/event-submission-table.tsx`, `lib/schema.ts`.

## 4. Kontrak API (Admin)

Prefix global `/api/v1`. Envelope: sukses `{ data, message }`; list `{ data, message, meta: { page, limit, total } }`; error `{ statusCode, message, errors }`. Unwrap sekali di `lib/api-client.ts` (`request`/`requestList`). Semua endpoint di bawah butuh JWT Bearer + permission admin.

| Metode | Endpoint | Body/Param | Keterangan |
| --- | --- | --- | --- |
| GET | `/event-submissions?page=&limit=&search=&sortBy=&sortOrder=&filter[status]=` | `search` (kolom `searchable`), `sortBy` whitelist backend, `filter[status]` (`REQUEST`/`APPROVED`/`REJECTED`) | list usulan (meta `{page,limit,total}`) |
| POST | `/event-submissions/:id/approve` | — | 200; backend recreate konten submission → row `Event` `status=DRAFT`; respons membawa `event` |
| POST | `/event-submissions/:id/reject` | — | 200; usulan ditolak, **tidak** membuat `Event` |

> **`POST /event-submissions` (create, publik) bukan milik FE ini** — dikonsumsi consumer eksternal. Kontrak create adalah **API publik backend**; rujuk `backend/docs/modules/event-submission.md`. FE ini **tidak** memanggilnya.

Tipe (`types.ts`, rencana):

```typescript
export interface EventSubmission {
  id: string
  title: string
  organiser: string
  country: string | null
  state: string | null
  startDate: string        // ISO 8601 UTC
  endDate: string | null
  status: 'REQUEST' | 'APPROVED' | 'REJECTED'
  createdAt: string
  updatedAt: string
}

export interface ApproveEventSubmissionResult {
  event: { id: string; slug: string; status: 'DRAFT' }
}
```

## 5. List — Search / Sort / Pagination (dikonsumsi dashboard)

State paginasi (`page`/`search`/`sortBy`/`sortOrder`/`filter[status]`) dipegang **container dashboard** (`dashboard-home.tsx`); hook meneruskan ke API + queryKey (pola `docs/module/user.md`).

- **Kolom searchable backend**: `title`, `organiser`.
- **Kolom tampil** (baris dashboard): `title`, `organiser`, `country`/`state`, `startDate`, `status`, `createdAt`.
- **Sortable (whitelist `sortBy` backend)**: `title`, `status`, `startDate`, `createdAt`, `updatedAt`. Bila dipakai di section, header di luar whitelist dirender `<TableHead>` biasa agar tidak memicu 422 `assertAllowedSort`.
- **Pagination** server-side: `limit=5`, pola §10g `dashboard.md` (`DataTablePagination`, `placeholderData: keepPreviousData`).
- **Search opsional dalam section**: bila diaktifkan, ikut pola §10g (SearchBar, debounce, `trim ≥ 2`, ubah search → `setPage(1)`); backend `searchable` `title`/`organiser`.
- **Query key**: `['event-submissions', { page, limit, search, sortBy, sortOrder, filter }]`.
- **Toast**: namespace `dashboard`, key `pendingSubmission.*` (bukan `event:*`).
- Contoh query: `/event-submissions?page=1&limit=5&filter[status]=REQUEST`.
- **State 403** (`isForbiddenError`) → empty-state `dashboard:section.pendingSubmissions.error`, dibedakan dari 401 (redirect login di `lib/api-client.ts`).

## 6. Aksi: Approve / Reject (call-site dashboard)

- **Approve** (gate `can('event-submission:approve')`): klik **Setujui** → `AlertDialog` konfirmasi → `approveEventSubmission.mutate(id, …)` → `POST /event-submissions/:id/approve`. Sukses: `toastSuccess(t('dashboard:pendingSubmission.approved'))` + **`navigate('/events/' + res.event.id + '/edit')`** (backend mengembalikan `{ event: { id, slug, status: 'DRAFT' } }`) agar admin mengedit draft sebelum publish.
- **Reject** (gate `can('event-submission:reject')`): klik **Tolak** → `AlertDialog` konfirmasi → `rejectEventSubmission.mutate(id, …)` → `POST /event-submissions/:id/reject`. Sukses: `toastSuccess(t('dashboard:pendingSubmission.rejected'))`; **tidak** navigasi (usulan tetap di section).
- **Invalidate** otomatis di hook: `['event-submissions']` + `['event']`.
- **Error**: non-422 → `toastError(getApiErrorMessage(err, t('dashboard:pendingSubmission.approveFailed'|'rejectFailed')))`; 422 early-return `if (isValidationError(err)) return;` (dialog tetap terbuka).

```tsx
// dashboard-home.tsx (rencana) — call-site
approveEventSubmission.mutate(submission.id, {
  onSuccess: (res) => {
    setApproving(null)
    toastSuccess(t('dashboard:pendingSubmission.approved'))
    navigate(`/events/${res.event.id}/edit`)
  },
  onError: (err: unknown) => {
    if (isValidationError(err)) return
    toastError(getApiErrorMessage(err, t('dashboard:pendingSubmission.approveFailed')))
  },
})
```

**Setelah approve**: `Event` `DRAFT` diedit di `/events/:id/edit` (modul `event`) lalu di-publish lewat alur publish existing (`event:publish`) — **tanpa** `event:submit`/`REQUEST`. Tercatat juga di `docs/module/event.md` §10.

## 7. Permissions

Tabel ini **hanya sisi admin**. Tidak ada permission create. **Tidak ada gate di level route** (tidak ada route) — gate query/aksi di dashboard.

| Aksi (di dashboard) | Kode | Dipakai |
| --- | --- | --- |
| Query list + render section | `event-submission:read` | `can('event-submission:read')` → `canReadSubmissions` |
| Tombol Setujui + `POST /event-submissions/:id/approve` | `event-submission:approve` | `can('event-submission:approve')` |
| Tombol Tolak + `POST /event-submissions/:id/reject` | `event-submission:reject` | `can('event-submission:reject')` |

- Gate via `can()` dari `useAuthPermissions()` di `dashboard-home.tsx`; komponen presentational menerima `canApprove`/`canReject` sebagai props.
- Backend men-seed tepat 3 permission di atas. **Tidak ada** permission create.

## 8. i18n

- **Tanpa namespace `event-submission` sendiri.** Semua key ditaruh di namespace **`dashboard`** (`src/i18n/locales/{en,id}/dashboard.json`), dipakai oleh section dashboard (§10h `dashboard.md`).
- Struktur key (namespace `dashboard`; key dipakai oleh section dashboard §10h):

  - `section.pendingSubmissions.{title,subtitle,empty,error}` — judul/subtitle section + empty/error state.
  - `pendingSubmission.{approve,reject,unknown}` — label tombol + fallback organiser.
  - `pendingSubmission.{approved,rejected,approveFailed,rejectFailed}` — toast call-site.
  - `pendingSubmission.confirm{Approve,Reject}{Title,Description}`, `pendingSubmission.confirm{Cancel,Submit}` — isi `AlertDialog`.
  - `section.pendingSubmissions.*` juga dipakai sebagai `entityName` pagination.

- **Tidak ada** key namespace `event-submission` maupun key `event-submission:admin.*` (semuanya dipindahkan ke namespace `dashboard`).

## 9. Desain

Mengikuti `docs/DESIGN_SYSTEM.md` (token, tanpa hardcode warna/radius; `cn()` dari `@/lib/utils`). Presentational baris section ada di `features/dashboard/components/dashboard-pending-submissions.tsx` (§10h `dashboard.md`) — **bukan** komponen di `features/event-submission/`.

- **Wajib komponen shadcn** (bila belum ada): `alert-dialog`, `badge`, `skeleton` — verifikasi keberadaan di `src/components/ui/` sebelum `pnpm dlx shadcn@latest add`.
- **Aksesibel**: tombol ikon-only wajib `aria-label`; `AlertDialog` untuk konfirmasi destructive.

## 10. Verifikasi (Rencana)

Belum dapat dijalankan — belum ada kode. Saat implementasi:

- `pnpm lint` → 0 error baru.
- `pnpm exec tsc -b --noEmit` → 0 error baru di file `event-submission*`.
- `pnpm dev` → **tidak ada** akses route/halaman submission; section dashboard tampil hanya bila `can('event-submission:read')`; pagination server-side `limit=5`.
- Cek manual: **Setujui** → `AlertDialog` → toast + `navigate('/events/<event.id>/edit')`; **Tolak** → `AlertDialog` → toast + list invalidate (tanpa navigasi); tombol digate `can('event-submission:approve'/'reject')`; invalidate `['event-submissions']` + `['event']`.
- Pastikan **tidak ada** panggilan create/upload dari FE, dan **tidak ada** string route/halaman `/event-submissions`, `EventSubmissionsPage`, `event-submission-table`.

## 11. Catatan

- **Status RENCANA**: seluruh isi §1–§11 adalah rencana; **belum ada file dibuat**. Backend `event-submission` dibangun paralel — rujuk `backend/docs/modules/event-submission.md`.
- **Tanpa route/halaman**: tidak ada route, halaman, menu sidebar, `EventSubmissionsPage`, atau `event-submission-table` untuk submission. Satu-satunya UI pengelolaan = section dashboard (§10h `dashboard.md`). Endpoint `/event-submissions` tetap dipakai sebagai **API**.
- **Create = API publik backend, bukan FE ini**: `POST /event-submissions` dikonsumsi website/consumer eksternal. Tidak ada halaman/form/upload di repo FE ini.
- **Hasil approve = `Event` `DRAFT`**: submission yang di-approve **direcreate backend** menjadi row `Event` `DRAFT`; admin diarahkan ke `/events/:id/edit` (pakai `event.id` dari respons approve) lalu publish via `event:publish`. Approval **melewati** `event:submit`/`REQUEST`. **Reject** = tidak dipindahkan.
- **Organiser** diresolusi backend menjadi `Network` (find-or-create) saat approve; FE admin hanya menampilkan `organiser` sebagai teks di baris section, tidak memanggil/membuat `Network`.
- **Submission + dashboard admin**: setiap submission `REQUEST` tampil di section dashboard (`docs/module/dashboard.md` §10h). `GET /event-submissions` mendukung `filter[status]` (dipakai section dashboard, `limit=5`).
- **Bedakan dengan editor `/events/*`**: `/events/*` modul internal berguard (`event:*`); endpoint submission memakai `/event-submissions` (bukan `/events`). Jangan campur hook/tipe.
