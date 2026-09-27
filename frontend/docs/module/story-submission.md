# Module: Story Submission (Admin) — Brief

Dokumen ini mencatat bagian **sisi ADMIN** modul Story Submission pada frontend React: **API + hooks** untuk list usulan story masuk + flow approve/reject, **dikonsumsi oleh container dashboard** (`src/app/routes/dashboard-home.tsx`). Mengikuti konvensi `frontend/AGENTS.md` dan meniru persis brief analog `docs/module/archive-submission.md`.

**Tujuan fitur**: consumer eksternal (website/pihak di luar EGS) mengirim usulan story lewat **API publik** backend → admin meninjau di **section dashboard** → usulan yang **di-approve direcreate backend menjadi row `Post`/`Story` berstatus `DRAFT`** → admin **diarahkan ke editor `/stories/:id/edit`** untuk mengedit, lalu **publish langsung** (alur publish existing, permission `story:publish`) agar tayang. **Reject = tidak dipindahkan** (usulan ditolak, tidak ada `Post` dibuat).

> **Status**: ✅ **implemented**. File `src/features/story-submission/`, view type `DashboardPendingStorySubmissionItem`, komponen `dashboard-pending-story-submissions.tsx`, halaman `app/routes/story-submission-detail.tsx`, wiring `dashboard-home.tsx`, dan i18n `dashboard` sudah dibuat. Verifikasi: `pnpm lint` (0 error baru), `pnpm exec tsc -p tsconfig.app.json --noEmit`, `pnpm build`.
>
> **Detail kini halaman penuh, bukan dialog.** Tombol **Lihat detail** baris kolom Publik section Story → `navigate('/story-submissions/' + id)` → route `story-submissions/:id` (`app/routes/story-submission-detail.tsx`) yang **memakai ulang komponen presentational `StoryDetail` apa adanya/unmodified** (`<StoryDetail story={mappedStory} />`, tanpa prop tambahan, tanpa komponen baru/variant). Halaman **read-only, mirror `story-detail.tsx` 1:1** — tanpa bar aksi / `AlertDialog` / state approve-reject; approve/reject **hanya** dari baris dashboard. Layout bare via `AppShell` (`isStorySubmissionDetail`). Dialog `story-submission-detail-dialog.tsx` **dihapus**.
>
> **Create TIDAK punya UI di repo ini.** Endpoint `POST /story-submissions` (publik) hanya **API backend** yang dikonsumsi **website/consumer eksternal** di luar FE ini. **Tidak ada halaman create, upload thumbnail publik, maupun hook create/upload di FE ini.** Kontrak create tetap final sebagai API publik backend. Keputusan ini **mirror** `event-submission`/`archive-submission`.
>
> **PENTING — beda dari workflow `story`/`Post` internal (`story:submit`)**: resource `story-submission` adalah **tabel terpisah** dengan **3 permission admin** (`story-submission:read/approve/reject`). Jangan menyatukan hooks/types/i18n dengan `use-stories`, `story:submit`, atau section `dashboard-pending-archives.tsx`. `use-story-submissions` ≠ `use-stories`.

## 1. Ruang Lingkup

**Termasuk (sisi admin):**

- API + hooks untuk **list** usulan story masuk (search/sort/pagination server-side).
- Halaman detail **`/story-submissions/:id`** — reuse `StoryDetail` **apa adanya (tanpa modifikasi, tanpa prop tambahan)**; **read-only, mirror `story-detail.tsx` 1:1** (tanpa bar aksi).
- API + hooks aksi **Setujui** (approve) → backend recreate `Post` `DRAFT` → redirect ke `/stories/:id/edit` (dipanggil dari **baris dashboard**).
- API + hooks aksi **Tolak** (reject) → usulan ditolak (dipanggil dari **baris dashboard**).
- Semua **dikonsumsi oleh section dashboard** (`dashboard.md` §10i).

**Tidak termasuk (tidak ada di FE ini):**

- Halaman **list** usulan story / menu sidebar khusus — list tetap di section dashboard; hanya ada route **detail**.
- Halaman publik untuk mengirim usulan story, form submission, upload thumbnail publik.
- `hooks/use-create-story-submission.ts`, `hooks/use-upload-story-submission-thumbnail.ts`, `components/story-submission-form.tsx`, schema form.
- Komponen tabel milik submission: presentational baris ada di `features/dashboard/components/dashboard-pending-story-submissions.tsx` (`dashboard.md` §10i); detail pakai ulang `features/story/components/story-detail.tsx`.

## 2. Routing & Permukaan UI

- **Route detail** `story-submissions/:id` (`app/routes/story-submission-detail.tsx`) di dalam `DashboardLayout` (`ProtectedRoute`), di-gate `RequirePermission code="story-submission:read"` (daftar route `stories/:id` dll tetap menang atas ranking statis di `app/routes/index.tsx`).
- **Layout bare**: `AppShell` mendeteksi `isStorySubmissionDetail = /^\/story-submissions\/[^/]+$/` → `return <Outlet />` (tanpa sidebar/header/padding, sama seperti `/stories/:id` & `/events/:id`).
- **Tidak ada entri sidebar** dan **tidak ada halaman list submission**.
- Gate aksi (`story-submission:approve`/`reject`) **hanya** di baris dashboard (`dashboard.md` §10i) via `can('story-submission:approve'/'reject')`; halaman detail hanya gate read `can('story-submission:read')` untuk query (`useStorySubmission(id, canRead)`).
- Halaman detail memakai ulang `StoryDetail` **apa adanya (unmodified — tidak ada prop tambahan, tidak ada komponen/variant baru)**; submission di-map ke objek `Story` agar komponen existing merender (hero, judul, meta, badge status/visibilitas default, konten tersanitasi, galeri, flyer). Halaman **read-only, mirror `story-detail.tsx` 1:1** — **tanpa** bar aksi/`AlertDialog`/state approve-reject; approve/reject **hanya** dari baris dashboard. Dibuka dari tombol **Lihat detail** baris kolom Publik → `navigate('/story-submissions/' + id)`.
- Render section: `dashboard-home.tsx` merender `DashboardSection` **Story** (judul `section.pendingStories.title`) dengan **2 kolom** (Member/Publik, mirror section Arsip). Kolom **Publik** = `DashboardPendingStorySubmissions` + `DataTablePagination` bila `canReadStorySubmissions = can('story-submission:read')`; kolom **Member** = `DashboardPendingStories` story internal `REQUEST`. Ditempatkan konsisten dengan section approval lain (setelah section **Arsip**).
- Permukaan UI: section dashboard admin (list + aksi cepat) + halaman detail `/story-submissions/:id`.

## 3. Struktur Folder

```
src/features/story-submission/
├── api/
│   └── story-submissions.ts              # listStorySubmissions, getStorySubmission, approveStorySubmission, rejectStorySubmission
├── hooks/
│   ├── use-story-submissions.ts          # query ['story-submissions', {...}] + keepPreviousData
│   ├── use-story-submission.ts           # query ['story-submission', { id }] (detail, enabled)
│   ├── use-approve-story-submission.ts   # invalidate ['story-submissions'] + ['story']
│   └── use-reject-story-submission.ts    # invalidate ['story-submissions'] + ['story']
└── types.ts                              # StorySubmission, StorySubmissionDetail, ApproveStorySubmissionResult
```

- **Konsumen**: halaman `src/app/routes/story-submission-detail.tsx` + container `src/app/routes/dashboard-home.tsx` (page boleh import hook lintas domain; komponen di `features/dashboard/` tetap presentational).
- Komponen shared dipakai ulang (tidak dibuat baru): `ui/alert-dialog`, `ui/badge`, `ui/button`, `ui/card`, `ui/skeleton`, `ui/separator` (via `StoryDetail`), `components/shared/data-table-pagination.tsx`, `features/story/components/story-detail.tsx` (presentational, reuse lintas-domain dari route).
- **Tidak ada** folder `components/` (dialog detail dihapus); **tidak ada** `app/routes/story-submissions.tsx` (index/list). Halaman detail = `app/routes/story-submission-detail.tsx`.

## 4. Kontrak API (Admin)

Prefix global `/api/v1`. Envelope: sukses `{ data, message }`; list `{ data, message, meta: { page, limit, total } }`; error `{ statusCode, message, errors }`. Unwrap sekali di `lib/api-client.ts` (`request`/`requestList`). Semua endpoint di bawah butuh JWT Bearer + permission admin.

| Metode | Endpoint | Body/Param | Keterangan |
| --- | --- | --- | --- |
| GET | `/story-submissions?page=&limit=&search=&sortBy=&sortOrder=&filter[status]=` | `search` (kolom `searchable`), `sortBy` whitelist backend, `filter[status]` (`REQUEST`/`APPROVED`/`REJECTED`) | list usulan (meta `{page,limit,total}`) |
| GET | `/story-submissions/:id` | — | detail satu usulan (admin `story-submission:read`); menambah `content` (HTML tersanitasi), `categoryIds`, `gallery[]`, `flyer[]`, `post: { id, slug, status } \| null` |
| POST | `/story-submissions/:id/approve` | — | 200; backend recreate konten submission → row `Post` `status=DRAFT`; respons `{ submission, story: { id, slug, status: 'DRAFT' } }` |
| POST | `/story-submissions/:id/reject` | body opsional `{ adminNote? }` | 200; usulan ditolak, **tidak** membuat `Post` |

> **`POST /story-submissions` (create, publik) bukan milik FE ini** — dikonsumsi consumer eksternal. Kontrak create adalah **API publik backend**. FE ini **tidak** memanggilnya.
>
> **`Post`/`Story` hasil recreate punya `slug`** (mirror `Event`), tetapi navigasi edit di FE ini memakai `story.id` (`navigate('/stories/' + res.story.id + '/edit')`).

Tipe (`types.ts`):

```typescript
export type StorySubmissionStatus = 'REQUEST' | 'APPROVED' | 'REJECTED'

export interface StorySubmission {
  id: string
  name: string
  thumbnail: string | null
  categories: { id: string; name: string }[]
  galleryCount: number
  flyerCount: number
  status: StorySubmissionStatus
  adminNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  postId: string | null
  post: { id: string; slug: string; status: string } | null
  createdAt: string
  updatedAt: string
}

// Detail `GET /story-submissions/:id` — menambah konten + relasi gambar.
export interface StorySubmissionDetail extends StorySubmission {
  content: string            // HTML dari API; sanitasi via `sanitizeHtml`
  categoryIds: string[]
  gallery: UploadedImage[]   // reuse tipe shared `@/types/image`
  flyer: UploadedImage[]
}

export interface ApproveStorySubmissionResult {
  submission: StorySubmission
  story: { id: string; slug: string; status: 'DRAFT' }
}
```

> **`shortDescription` dihapus** dari kontrak list; kolom deskripsi diganti `categories` + `galleryCount`/`flyerCount` (server-derived) + `content` (hanya di detail, HTML tersanitasi).

`api/story-submissions.ts` meniru `features/archive-submission/api/archive-submissions.ts`: `listStorySubmissions` (`requestList` + `appendListParams` + `filter[key]`), `getStorySubmission(id)` (`GET`, `request`), `approveStorySubmission(id)` (`POST`, `request`), `rejectStorySubmission(id)` (`POST`, `request`).

## 5. List — Search / Sort / Pagination (dikonsumsi dashboard)

State paginasi (`page`/`search`/`sortBy`/`sortOrder`/`filter[status]`) dipegang **container dashboard** (`dashboard-home.tsx`); hook meneruskan ke API + queryKey.

- **Kolom searchable backend**: `name` (kontrak `shortDescription` dihapus).
- **Kolom tampil** (baris dashboard): `name`, `categories[].name` (join ` · `), `thumbnail`, `galleryCount`/`flyerCount` (chip ikon bila > 0), `status`, `createdAt`.
- **Sortable (whitelist `sortBy` backend)**: `name`, `status`, `createdAt`, `updatedAt`.
- **Pagination** server-side: `limit=5`, pola `dashboard.md` §10g (`DataTablePagination`, `placeholderData: keepPreviousData`).
- **Query key**: `['story-submissions', { page, limit, search, sortBy, sortOrder, filter }]`.
- **Toast**: namespace `dashboard`, key `pendingStorySubmission.*` (bukan `story:*`), dipasang di **call-site dashboard**.
- Contoh query: `/story-submissions?page=1&limit=5&filter[status]=REQUEST`.
- **State 403** (`isForbiddenError`) → empty-state differentiated dari 401 (`section.pendingStorySubmissions.error`), sedangkan 401 redirect login di `lib/api-client.ts`.

## 6. Aksi: Approve / Reject (call-site dashboard saja)

- **Approve** (gate `can('story-submission:approve')`): klik **Setujui** di baris dashboard → `AlertDialog` konfirmasi → `approveStorySubmission.mutate(id, …)` → `POST /story-submissions/:id/approve`. Sukses: `toastSuccess(t('dashboard:pendingStorySubmission.approved'))` + **`navigate('/stories/' + res.story.id + '/edit')`** agar admin mengedit draft sebelum publish.
- **Reject** (gate `can('story-submission:reject')`): klik **Tolak** di baris dashboard → `AlertDialog` konfirmasi → `rejectStorySubmission.mutate(id, …)` → `POST /story-submissions/:id/reject`. Sukses: `toastSuccess(t('dashboard:pendingStorySubmission.rejected'))`; call-site dashboard **tidak** navigasi.
- Aksi **hanya** di **satu call-site**: baris list dashboard (`dashboard-home.tsx`, aksi cepat). Halaman detail `/story-submissions/:id` **read-only** (mirror `story-detail.tsx` 1:1) — tidak ada bar aksi/`AlertDialog`/state approve-reject.
- **Invalidate** otomatis di hook: `['story-submissions']` + `['story-submission']` + `['story']`.
- **Error**: non-422 → `toastError(getApiErrorMessage(err, t('dashboard:pendingStorySubmission.approveFailed'|'rejectFailed')))`; 422 early-return `if (isValidationError(err)) return;` (dialog konfirmasi tetap terbuka).

```tsx
// dashboard-home.tsx — call-site (satu-satunya)
approveStorySubmission.mutate(submission.id, {
  onSuccess: (res) => {
    setApproveStorySubmissionId(null)
    toastSuccess(t('pendingStorySubmission.approved'))
    navigate(`/stories/${res.story.id}/edit`)
  },
  onError: (err: unknown) => {
    if (isValidationError(err)) return
    toastError(getApiErrorMessage(err, t('pendingStorySubmission.approveFailed')))
  },
})
```

**Setelah approve**: `Post` `DRAFT` diedit di `/stories/:id/edit` (modul `story`) lalu di-publish lewat alur publish existing (`story:publish`) — **tanpa** `story:submit`/`REQUEST`.

## 7. Permissions

Tabel ini **hanya sisi admin**. Tidak ada permission create. Route detail di-gate `RequirePermission code="story-submission:read"` di `app/routes/index.tsx`; gate query/aksi lain di dashboard & komponen detail.

| Aksi | Kode | Dipakai |
| --- | --- | --- |
| Route detail `/story-submissions/:id` + query list + render section | `story-submission:read` | `RequirePermission` + `can('story-submission:read')` → `canReadStorySubmissions` / `canRead` |
| Tombol Setujui + `POST /story-submissions/:id/approve` | `story-submission:approve` | `can('story-submission:approve')` |
| Tombol Tolak + `POST /story-submissions/:id/reject` | `story-submission:reject` | `can('story-submission:reject')` |

- Gate via `RequirePermission` (route detail) + `can()` dari `useAuthPermissions()` di `dashboard-home.tsx` & `story-submission-detail.tsx` (detail hanya `canRead` untuk query); komponen presentational (`dashboard-pending-story-submissions.tsx`) menerima `canApprove`/`canReject` sebagai props.
- Backend men-seed tepat 3 permission di atas. **Tidak ada** permission create.

## 8. i18n

- **Tanpa namespace `story-submission` sendiri.** Semua key ditaruh di namespace **`dashboard`** (`src/i18n/locales/{en,id}/dashboard.json`), dipakai oleh section dashboard.
- Struktur key (namespace `dashboard`; mirror key `pendingArchiveSubmission.*`):

  - `section.pendingStorySubmissions.{title,subtitle,empty,error}` — `empty`/`error` dipakai internal `dashboard-pending-story-submissions.tsx` (kolom Publik). `title`/`subtitle` tidak lagi jadi judul section (section Story 2-kolom memakai `section.pendingStories.*`); pagination kolom Publik memakai `entityName = column.public`.
  - `pendingStorySubmission.{approve,reject,statusRequest}` — label tombol + badge "Diajukan" (`statusRequest`; dipakai baris kolom Publik).
  - `pendingStorySubmission.{galleryCount,flyerCount}` — `title`/tooltip chip ikon jumlah galeri/flyer (`Images`/`Image`) di baris kolom Publik.
  - `pendingStorySubmission.{approved,rejected,approveFailed,rejectFailed}` — toast call-site **dashboard** (baris list).
  - `pendingStorySubmission.confirm{Approve,Reject}{Title,Description}`, `pendingStorySubmission.confirm{Cancel,Submit}` — isi `AlertDialog` **dashboard** (baris list).
  - `pendingStorySubmission.detail.*` **dihapus** (dialog lama dihapus). Label galeri/flyer tidak ada: halaman detail memakai key `story:detail.*` (dari `StoryDetail`) + `story:errors.*` (forbidden/loadDetail/notFound).

- **Tidak ada** key namespace `story-submission` (semuanya di namespace `dashboard`).

## 9. Desain

Mengikuti `docs/DESIGN_SYSTEM.md` (token, tanpa hardcode warna/radius; `cn()` dari `@/lib/utils`). Presentational baris section ada di `features/dashboard/components/dashboard-pending-story-submissions.tsx`.

- **Komponen baru**: `features/dashboard/components/dashboard-pending-story-submissions.tsx` — presentational murni (hanya `components/ui`, `lib`, `i18n`; **tanpa import lintas domain** `features/story-submission`).
  - Props (exported `interface`), mirror `DashboardPendingArchiveSubmissionsProps`: `items: DashboardPendingStorySubmissionItem[]`, `isPending`, `isError`, `canApprove`, `canReject`, `isRefreshing?`, `onViewDetail(id)`, `onApprove(id)`, `onReject(id)`, `busyId?`, `className?`.
  - Baris: thumbnail + fallback `ImageOff`, `name`, badge "Diajukan", baris kategori (`categories.join(' · ')`), baris kecil `CalendarDays` (`dateLabel`) + chip ikon `Images` `galleryCount` / `Image` `flyerCount` (hanya bila > 0, tooltip `galleryCount`/`flyerCount`), tombol **Lihat detail** (`Eye`) + Setujui/Tolak ter-gate. Loading → `Skeleton`; kosong → `section.pendingStorySubmissions.empty`; error → `section.pendingStorySubmissions.error` (muted).
- View type `DashboardPendingStorySubmissionItem` ditambahkan ke `features/dashboard/types.ts` (dashboard tetap bebas import lintas domain): `id`, `name`, `thumbnail`, `categories: string[]`, `galleryCount`, `flyerCount`, `dateLabel` (dari `createdAt` via `formatDate`).
- **Halaman detail** (`app/routes/story-submission-detail.tsx`): container **read-only, mirror `story-detail.tsx` 1:1**. `useParams`/`useNavigate`/`useLocation` + `useAuthPermissions`; `useStorySubmission(id ?? '', canRead)`; map `StorySubmissionDetail` → objek `Story` (`{ id, name, slug: '', status: REQUEST/APPROVED (REJECTED→'DRAFT'), visibility: 'PUBLIC', publishedAt: createdAt, content, thumbnail, categories.map(c => ({...c, type:'STORY'})), creator: null, gallery, flyer, createdAt, updatedAt }`). Shell identik `story-detail.tsx`: back button `ArrowLeft` `absolute left-4 top-4 z-20` (glass, `navigate(-1)` fallback `/`), `min-h-svh bg-background`, `Skeleton` saat pending, 403 (`story:errors.forbidden`), error lain (`story:errors.loadDetail` + retry), tanpa data (`story:detail.notFound`). Render `<StoryDetail story={mappedStory} />` (**tanpa prop tambahan**; badge status/visibilitas default dari komponen existing). **Tidak ada** bar aksi/`AlertDialog`/state approve-reject — approve/reject hanya dari baris dashboard.
- **Tombol "Lihat detail"** baris kolom Publik: `Button variant="ghost" size="sm"` + ikon `Eye` (mirror `dashboard-pending-archives.tsx`), memanggil `onViewDetail(id)` → container `navigate('/story-submissions/' + id)`.
- **`StoryDetail` (presentational, dipakai ulang tanpa modifikasi)**: komponen `features/story/components/story-detail.tsx` **tidak diubah** — tidak ada prop opsional baru, tidak ada komponen/variant baru. Halaman submission meng-map `StorySubmissionDetail` → `Story` (status `REQUEST`/`APPROVED`, `REJECTED`→`DRAFT`; `visibility: 'PUBLIC'`; `creator: null`; `publishedAt: submission.createdAt`; `categories.map(c => ({...c, type:'STORY'}))`) lalu render `<StoryDetail story={mappedStory} />`. Perilaku `/stories/:id` sepenuhnya tak berubah.
- **Aksesibel**: tombol aksi `disabled` saat `busyId`/`isRefreshing` + `aria-busy`; `AlertDialog` untuk konfirmasi destructive; back button `aria-label`/`title` `story:detail.back`.

## 10. Verifikasi

Dijalankan saat implementasi:

- `pnpm lint` → 0 error baru.
- `pnpm exec tsc -p tsconfig.app.json --noEmit` → 0 error baru (catatan: `pnpm tsc --noEmit` **no-op** karena `tsconfig.json` `files: []`).
- `pnpm build` → sukses.
- Cek manual: **Lihat detail** → `navigate('/story-submissions/<id>')` (halaman penuh, layout bare, reuse `StoryDetail`, **read-only tanpa aksi**); dari **baris dashboard**: **Setujui** → `AlertDialog` → toast + `navigate('/stories/<story.id>/edit')`; **Tolak** → `AlertDialog` → toast + invalidate (dashboard); tombol digate `can('story-submission:approve'/'reject')`; invalidate `['story-submissions']` + `['story-submission']` + `['story']`.
- Pastikan **tidak ada** panggilan create/upload dari FE; `/stories/:id` (detail story internal) tetap utuh (`StoryDetail` **tidak dimodifikasi** — tanpa prop baru, byte-for-byte sama); `/story-submissions/:id` tidak menampilkan bar aksi apa pun.

## 11. Catatan

- **Status implemented**: seluruh isi §1–§11 sudah diterapkan di FE. Backend `story-submission` dibangun paralel.
- **Bedakan dari workflow `story`/`Post` INTERNAL (JANGAN dicampur)**: resource `post`/`story` **sudah punya** workflow submit/approve/reject internal (`story:submit`, endpoint `/posts`, `POST /posts/:id/{submit,approve,reject}`) — lihat `docs/module/story.md`. Modul **ini** adalah **jalur submission PUBLIK yang TERPISAH**: tabel `story-submission` sendiri, section `dashboard-pending-story-submissions.tsx` sendiri, endpoint `/story-submissions` sendiri, dan komponen `DashboardPendingStorySubmissions` sendiri. **Jangan menyatukan** hooks/types/i18n keduanya; `use-story-submissions` ≠ `use-stories`.
- **Route detail + section dashboard**: tombol Lihat detail → `/story-submissions/:id` (halaman penuh, reuse `StoryDetail`, gate `story-submission:read`). List + aksi cepat tetap section dashboard (`dashboard.md` §10i). Tidak ada `StorySubmissionsPage`/list route/menu sidebar. Endpoint `/story-submissions` tetap dipakai sebagai **API**.
- **Create = API publik backend, bukan FE ini**: `POST /story-submissions` dikonsumsi website/consumer eksternal. Tidak ada halaman/form/upload di repo FE ini.
- **Hasil approve = `Post` `DRAFT`**: submission yang di-approve **direcreate backend** menjadi row `Post` `DRAFT`; admin diarahkan ke `/stories/:id/edit` (pakai `story.id` dari respons approve) lalu publish via `story:publish`. Approval **melewati** `story:submit`/`REQUEST`. **Reject** = tidak dipindahkan.
- **Submission + dashboard admin**: setiap submission `REQUEST` tampil di section dashboard. `GET /story-submissions` mendukung `filter[status]` (dipakai section dashboard, `limit=5`).
- **Halaman detail**: `GET /story-submissions/:id` (`getStorySubmission` → `StorySubmissionDetail` dengan `content`/`categoryIds`/`gallery`/`flyer`) + hook `useStorySubmission(id, enabled)` (`['story-submission', { id }]`, `staleTime: 30_000`, `enabled: Boolean(id)`) dipakai halaman `app/routes/story-submission-detail.tsx`. Halaman **read-only, mirror `story-detail.tsx` 1:1** (tanpa bar aksi/`AlertDialog`/state approve-reject). Detail di-map ke objek `Story` lalu dirender `StoryDetail` — `content` disanitasi `sanitizeHtml` (`@/lib/sanitize-html`, DOMPurify) di dalam `StoryDetail` sebelum `dangerouslySetInnerHTML`; `gallery`/`flyer` (`UploadedImage[]`) dirender `StoryGallery`. Aksi Setujui/Tolak hanya dari baris dashboard (`AlertDialog` + hooks existing). Back button → `navigate(-1)` fallback `/`.
- **Bedakan dengan editor `/stories/*`**: `/stories/*` modul internal berguard (`story:*`); endpoint submission memakai `/story-submissions` (bukan `/posts`/`/stories`). Jangan campur hook/tipe.
