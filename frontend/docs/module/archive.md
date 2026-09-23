# Module: Archives — Brief

Dokumen ini mencatat rencana desain/implementasi halaman **Archives** pada frontend React — list arsip + editor create/edit full-page dengan **2 section** (Informasi + Link & Dokumen). Mengikuti konvensi `AGENTS.md` frontend dan format brief `docs/module/dashboard.md`, meniru pola List CRUD modul `user`/`roles` serta struktur modul `story` (closest analog: `docs/module/story.md`).

> **Status dokumen**: ini **brief** (rencana), bukan laporan implementasi. Backend modul `archive` **belum diimplementasikan**; endpoint di bawah mengikuti kontrak arsitek di `backend/docs/modules/archive.md` (ditulis paralel). Resource backend = **`archive`** sebagai **model terpisah, BUKAN `Post`**. Implementasi frontend disusun terhadap kontrak tersebut; verifikasi end-to-end menunggu backend siap.

## 1. Tujuan & Ruang Lingkup

- Menyediakan pengelolaan **Arsip** (resource backend = `archive`) untuk admin: daftar arsip (pagination/search/sort/filter), tambah, edit, hapus.
- Menu frontend bernama **Archives**; resource backend `archive` (`Archive`, enum `ArchiveType`/`ArchiveStatus`).
- Editor **full-page (bukan dialog)** dengan **2 section**: (1) **Informasi** — field teks + thumbnail; (2) **Link & Dokumen** — daftar link eksternal berurut + dokumen PDF berurut.
- **Workflow approval mirip Event**: status `DRAFT | REQUEST | APPROVED | PUBLISHED`; aktor non-admin `create` + `submit` (`Ajukan untuk Terbit`), approver `approve`/`reject` lewat bar `REQUEST`. Status tetap ditentukan lewat **tombol aksi**, **bukan** Select status.
- Mengonsumsi API backend prefix global `/api/v1` (`lib/api-client.ts`), endpoint butuh JWT Bearer (di-attach otomatis).
- **Di luar lingkup iterasi ini**: preview publik dan audit log. Route detail `/archives/:id` read-only sifatnya **opsional** (didaftarkan, layout bare).

## 2. Routing

- Route didaftarkan di `src/app/routes/index.tsx`, sebagai child di bawah `DashboardLayout` (yang sudah `ProtectedRoute`).
- Route **list** dibungkus `<RequirePermission code="archive:read">`; route **create/update** cek permission (`archive:create`/`archive:update`) di **dalam komponen** editor (gate isi halaman, bukan redirect seluruh route).
- Semua route statis berbagi prefix `/archives`.
- **Route create/edit adalah child normal `DashboardLayout`/`AppShell`**: sidebar + navbar/header **tetap tampil**; form sekadar ter-render di dalam area konten `<Outlet/>` seperti halaman biasa. **TIDAK ada** branch khusus di `app-shell.tsx`, **tidak perlu** `isArchiveEditor`, dan **tidak perlu** generalisasi branch editor story/event.

```
/                      (parent → DashboardLayout, ProtectedRoute)
├── /archives           → list (tabel/kartu)    — RequirePermission code="archive:read"
├── /archives/new       → editor create          — gate archive:create di komponen
├── /archives/:id/edit  → editor edit            — gate archive:update di komponen
└── /archives/:id       → detail (read-only)     — gate archive:read di komponen (layout bare, opsional)
```

Registrasi memakai peringkat React Router: `archives/new` (segmen statis) tetap menang atas `archives/:id` (dinamis), dan `archives/:id/edit` beda jumlah segmen — tidak ada konflik.

Contoh bentuk pendaftaran:

```tsx
// src/app/routes/index.tsx (child di bawah dashboard)
{ path: 'archives', element: (<RequirePermission code="archive:read"><ArchivesPage /></RequirePermission>) },
{ path: 'archives/new', element: <ArchiveNewPage /> },
{ path: 'archives/:id/edit', element: <ArchiveEditPage /> },
{ path: 'archives/:id', element: <ArchiveDetailPage /> },
```

### Navigasi sidebar

- Tambah item **Archives** ke grup **Dashboard** di `src/features/dashboard/components/app-shell.tsx` (`dashboardNavItems`, **bersebelahan dengan Story**), ikon lucide `Archive` (alternatif `FolderArchive`), `url: '/archives'`, `permission: 'archive:read'` (menu Archives **terlihat oleh pemegang `archive:read`** — non-admin member/organization ikut melihat; gate route list tetap `archive:read`, sama dengan menu). **Bukan** `dataManagementNavItems`.
- Label dari i18n: `dashboard:nav.archives` (tambah key di `src/i18n/locales/{en,id}/dashboard.json`).
- Penyaringan menu memakai `isNavVisible` + `can` yang sudah ada (`app-shell.tsx`) — tidak perlu mekanisme baru.

## 3. Struktur File yang Direncanakan

```
src/app/routes/
├── archives.tsx         # halaman list (state page/search/sort, mutation, dialog hapus)
├── archive-new.tsx      # halaman create (container form editor)
├── archive-edit.tsx     # halaman edit (container form editor, load detail)
└── archive-detail.tsx   # halaman detail read-only (gate archive:read, layout bare, opsional)

src/features/archive/
├── api/
│   ├── archives.ts      # listArchives, getArchive, createArchive, updateArchive, deleteArchive
│   ├── categories.ts    # listArchiveCategories, createArchiveCategory
│   ├── images.ts        # uploadImage (multipart → POST /images) — thumbnail (image), TIDAK diubah; entityType default 'post'
│   └── documents.ts     # uploadDocument (multipart → POST /documents, application/pdf max 10 MB) — dokumen PDF
├── hooks/
│   ├── use-archives.ts          # query ['archive', {page,limit,search,sortBy,sortOrder,filter}], keepPreviousData
│   ├── use-archive.ts           # query ['archive', {id}] (detail edit)
│   ├── use-create-archive.ts    # mutation → invalidate ['archive']
│   ├── use-update-archive.ts    # mutation → invalidate ['archive'] + ['archive', {id}]
│   ├── use-delete-archive.ts    # mutation → invalidate ['archive']
│   ├── use-upload-image.ts      # mutation POST /images — thumbnail (image), TIDAK diubah; tanpa invalidate list
│   ├── use-upload-document.ts   # mutation POST /documents — dokumen PDF; tanpa invalidate list
│   ├── use-categories.ts        # query ['categories', { type: 'ARCHIVE' }], staleTime ≥ 60s
│   └── use-create-category.ts   # mutation POST /categories { type: 'ARCHIVE' } → invalidate ['categories']
├── components/
│   ├── archive-form.tsx         # form editor full-page (2 section) dipakai create/edit
│   ├── archive-table.tsx        # presentational tabel + aksi baris
│   ├── archive-card.tsx         # presentational kartu (mode Card)
│   ├── archive-detail.tsx       # presentational detail read-only (opsional)
│   ├── external-links-input.tsx # daftar baris URL berurut (reusable)
│   ├── document-upload.tsx      # upload multiple PDF + daftar + hapus + reorder (reusable)
│   └── status-variant.ts        # peta ArchiveStatus → Badge variant (dipakai tabel + kartu)
├── lib/
│   └── schema.ts                # skema zod + ArchiveFormValues
└── types.ts                     # Archive, ArchiveType, ArchiveStatus, ArchiveCategory, ArchiveCreator, ArchiveDocument, UploadedImage, CreateArchiveInput, UpdateArchiveInput
```

`components/shared/category-combobox.tsx` (hasil **refactor**, lihat §8 poin Kategori) — dipindah dari `features/story/components/category-combobox.tsx` karena dipakai 2 fitur (story + archive).

`types.ts` (rancangan, mengikuti kontrak locked — **tidak mengarang field**):

```ts
export type ArchiveType = 'MEMBER' | 'PUBLIC'
export type ArchiveStatus = 'DRAFT' | 'PUBLISHED'

export interface ArchiveCategory { id: string; name: string; type: CategoryType } // CategoryType reused: 'STORY' | 'ARCHIVE'
export interface ArchiveCreator { id: string; fullName: string }

// Thumbnail (image) memakai `UploadedImage` shared APA ADANYA (non-null width/height).
// TIDAK ada perubahan tipe shared — `src/types/image.ts` tidak disentuh agar
// story/event tidak ikut bergetar (ripple).
export type { UploadedImage } from '@/types/image'

// Tipe **lokal archive** untuk dokumen PDF — didefinisikan eksplisit supaya
// TIDAK mengharuskan `width`/`height` nullable di tipe shared. PDF tidak punya
// dimensi. `mimeType`/`size` **nullable** mengikuti kolom backend.
//   Bentuk `UploadedImage` (shared, TIDAK diubah):
//   { id, url, key, filename, mimeType: string | null, size, width: number, height: number, variants: ImageVariant[] }
export interface ArchiveDocument {
  id: string
  url: string
  key: string
  filename: string
  mimeType: string | null
  size: number | null
}

// Detail (`GET /archives/:id`): dokumen terhidrasi.
// List (`GET /archives`): TIDAK ada `documents` (lihat §6/§7).
export interface Archive {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  type: ArchiveType
  status: ArchiveStatus
  publishedAt: string | null
  externalLinks: string[]          // daftar URL berurut
  categories: ArchiveCategory[]
  creator: ArchiveCreator | null
  documents?: ArchiveDocument[]    // hanya ada pada detail; terurut (hydrated dari documentIds)
  createdAt: string
  updatedAt: string
}

export interface CreateArchiveInput {
  name: string
  description?: string
  thumbnail?: string       // cukup URL string (hasil POST /images); TIDAK ada imageIds/binding Image
  type?: ArchiveType       // default PUBLIC
  status?: ArchiveStatus   // default DRAFT
  publishedAt?: string     // ISO 8601 UTC
  categoryIds?: string[]
  externalLinks?: string[] // berurut; bila dikirim = replace seluruh array
  documentIds?: string[]   // berurut (documents.map(d => d.id)); bila dikirim = replace seluruh array
}
// Wajib override `thumbnail` (mirror UpdateArchiveDto): `undefined` = jangan sentuh, `null` = hapus.
// `extends Partial<CreateArchiveInput>` langsung → TS2430 (base `thumbnail` = `string`); `Omit` dulu lalu override.
export interface UpdateArchiveInput extends Partial<Omit<CreateArchiveInput, 'thumbnail'>> {
  thumbnail?: string | null
}
```

Catatan: `externalLinks` = `string[]` (tidak ada type wrapper `ExternalLink`); `documents` hanya muncul pada **detail** (`GET /archives/:id`), field mentah `documentIds` **tidak** dikembalikan. `documents` memakai tipe **lokal** `ArchiveDocument` (interface eksplisit, `mimeType`/`size` nullable), bukan `UploadedImage` penuh — sehingga `width`/`height` shared **tidak** perlu dilonggarkan dan `UploadedImage` (dipakai story/event) **tidak berubah**. `thumbnail` hanyalah **string URL absolut** hasil upload image (tidak ada `imageIds`/binding Image di payload — berbeda dari story). `UpdateArchiveInput.thumbnail` menerima `string | null` (bukan sekadar `string`) agar penghapusan thumbnail dapat diekspresikan. `documentIds = documents.map(d => d.id)` dikirim berurut.

## 4. Dependency Baru

- **TIDAK ada dependency baru.** Editor ini tidak memakai rich text (deskripsi cukup `Textarea` teks biasa), sehingga TipTap dan `dompurify` (dipakai story) **tidak dibutuhkan**.
- Upload memakai **dua fungsi/hook TERPISAH** (keduanya tanpa dependency baru): thumbnail **image** via `uploadImage` (`api/images.ts`) / `useUploadImage` (`hooks/use-upload-image.ts`, **tidak diubah**, pola `use-upload-image` story); dokumen **PDF** via `uploadDocument` (`api/documents.ts`) / `useUploadDocument` (`hooks/use-upload-document.ts`) → `POST /documents`. Reorder dokumen memakai tombol naik/turun (DnD HTML5 native opsional, tanpa `dnd-kit`).
- `@tanstack/react-query`, `react-hook-form`, `zod`, `sonner` sudah terpasang (dipakai modul existing).

## 5. Komponen UI via CLI

- Komponen shadcn yang dibutuhkan **sudah tersedia** — dipakai ulang tanpa `add` baru: `button`, `input`, `label`, `form`, `textarea`, `select`, `badge`, `card`, `separator`, `table`, `skeleton`, `dialog`, `alert-dialog`, `dropdown-menu`, `popover`, `command`, `toggle`, `tooltip`, `sonner`.
- **Verifikasi sebelum implementasi**: cek tiap file di `src/components/ui/`; bila ada yang benar-benar belum ada, tambah via CLI (larang edit manual `src/components/ui/`):
  ```
  pnpm dlx shadcn@latest add <component>
  ```
- Komponen reusable di `components/shared/`: `search-bar.tsx`, `sortable-header.tsx`, `data-table-pagination.tsx`, `date-time-picker.tsx`, `card-grid.ts` (semua sudah ada), dan `category-combobox.tsx` (dipindah, lihat §3/§8).
- Hook bersama `lib/use-file-drop.ts` dipakai ulang untuk dropzone `document-upload.tsx`/thumbnail (pola `thumbnail-upload.tsx`).

## 6. Kontrak API (kontrak arsitek `backend/docs/modules/archive.md`)

Envelope: sukses `{ data, message }`; list `{ data, message, meta: { page, limit, total } }`; error `{ statusCode, message, errors }`. Unwrap dilakukan sekali di `lib/api-client.ts` (`request`/`requestList`).

### Permissions

| Kode | Guna |
| --- | --- |
| `archive:read` | Gate halaman list/detail + menu sidebar; non-admin hanya lihat arsip **miliknya** (`mine=true`), admin/approver lihat **semua** |
| `archive:create` | Gate tombol Tambah + editor create + `POST /documents` (PDF) — **tidak** menggate `POST /images` |
| `archive:update` | Gate editor edit + `PATCH /archives/:id` + `POST /documents` (PDF) — **tidak** menggate `POST /images` |
| `archive:delete` | Gate aksi hapus |
| `category:read` | Gate pemuatan opsi kategori |
| `category:create` | Gate "tambah kategori baru" |

### Endpoint

| Metode | Endpoint | Body/Param | Keterangan |
| --- | --- | --- | --- |
| GET | `/archives?page=&limit=&search=&sortBy=&sortOrder=&mine=&filter[type]=&filter[status]=` | `search` OR `name, description`; `sortBy` ∈ `name,type,status,publishedAt,createdAt,updatedAt`; `filter` ∈ `type,status,publishedAt,createdAt,updatedAt`; `mine=true` → hanya arsip milik user; default `createdAt desc` | list paginated; item include `categories: {id,name,type}[]` + `creator: {id,fullName} \| null` — **TIDAK** mengembalikan `documents` |
| GET | `/archives/:id` | — | detail termasuk `description`, `externalLinks: string[]`, `documents: ArchiveDocument[]` (ordered; tipe lokal eksplisit tanpa `width`/`height`/`variants`, `mimeType`/`size` nullable) |
| POST | `/archives` | `{ name, description?, thumbnail?, type?, status?, publishedAt?, categoryIds?, externalLinks?, documentIds? }` | 201; 422 validasi. `type` default `PUBLIC`, `status` default `DRAFT`; `thumbnail` = URL string, `documentIds` = id dokumen berurut |
| PATCH | `/archives/:id` | partial (field sama, semua opsional) | `categoryIds`/`externalLinks`/`documentIds` bila dikirim = **REPLACE seluruh array** (urut; `[]` mengosongkan); `thumbnail` string\|null; 422 |
| DELETE | `/archives/:id` | — | 200 |
| POST | `/images` | multipart field `file`; `entityType` **default `'post'`** (atau dihilangkan). Mime & max: `image/png\|jpeg\|webp` max **5 MB** (thumbnail) | **TIDAK diubah** — khusus thumbnail image. 201 `{ data: UploadedImage, message }` = `{ id, url, key, filename, mimeType, size, width, height, variants }`; `url` **absolut** S3. Permission `POST /images` **tetap** `story:create\|story:update\|event:create\|event:update` (unchanged; `archive:*` **tidak** menggate image) |
| POST | `/documents` | multipart field `file`; `application/pdf` only, max **10 MB**. Permission `archive:create` **ATAU** `archive:update` | 201 `{ data: { id, url, key, filename, mimeType, size }, message }` — endpoint **TERPISAH** untuk dokumen PDF; `url` **absolut** S3. Dipakai `uploadDocument`/`useUploadDocument` (`api/documents.ts`) |
| GET | `/categories?filter[type]=ARCHIVE&limit=100` | `sortBy` ∈ `name,type,createdAt,updatedAt` | opsi kategori editor |
| POST | `/categories` | `{ name, type: 'ARCHIVE' }` | **idempotent** — nama+type sama mengembalikan existing (bukan 409); dipakai "tambah kategori langsung" |

Catatan: endpoint list/sort/filter mengikuti `RULES.md` Bab 19/19a/19b (whitelist kolom, filter generik `filter[field]`). `filter[type]`/`filter[status]` memakai enum `ArchiveType`/`ArchiveStatus`.

Catatan dokumen: `documents` **hanya** ada di detail (`GET /archives/:id`), diambil dari field mentah `documentIds` (berurut); list `GET /archives` tidak menyertakannya. FE menyimpan daftar hasil upload `ArchiveDocument[]` (interface lokal eksplisit, `mimeType`/`size` nullable). Bila `documentIds` dikirim saat update = **replace seluruh daftar** (urut). Tidak ada endpoint delete dokumen → menghapus item dari form tidak menghapus aset di S3 (orphan, lihat §14).

**Konfirmasi alur upload (DUA fungsi TERPISAH):** thumbnail **image** lewat `POST /images` (`api/images.ts:uploadImage` / `use-upload-image.ts:useUploadImage`, **TIDAK diubah**, `entityType` default `'post'` atau dihilangkan — **bukan** `'archive'`; png/jpeg/webp max **5 MB**) → `201 { data: UploadedImage, message }`, disimpan sebagai **string URL** di field `thumbnail` (tanpa `imageIds`/binding Image). Permission `POST /images` **tetap** `story:create|story:update|event:create|event:update` (**unchanged**; `archive:*` tidak menggate image) sehingga aktor perlu salah satu izin image-upload — admin punya semua; aktor arsip saja perlu `story:create/update` (upgrade path dicatat §14). Dokumen **PDF** lewat **endpoint terpisah** `POST /documents` (`api/documents.ts:uploadDocument` / `use-upload-document.ts:useUploadDocument`, `application/pdf` only max **10 MB**, permission `archive:create` OR `archive:update`) → `201 { data: { id, url, key, filename, mimeType, size }, message }`; `url` absolut S3. FE meng-append `data` ke state `documents: ArchiveDocument[]`, lalu payload archive mengirim `documentIds = documents.map(d => d.id)` **berurut** (replace saat update). `document-upload.tsx` memanggil `use-upload-document` (**bukan** `use-upload-image`); `use-upload-image` hanya untuk thumbnail.

## 7. Halaman List (`/archives`)

Container `src/app/routes/archives.tsx`. Mengikuti pola List CRUD `AGENTS.md` (mode Card/List toggle, SearchBar, SortableHeader, DataTablePagination, empty state, delete AlertDialog).

> **Kontrak list.** `GET /archives` **tidak** mengembalikan `documents`. Halaman list **tidak boleh** mengharapkan/menampilkan/mengakses `documents` (tipe `Archive.documents` opsional; jangan render kolom/preview dokumen, jangan `.map` tanpa guard). Dokumen hanya dimuat oleh editor via detail (§8) dan opsional halaman detail.

Halaman punya **2 mode layout** dengan toggle (default **card**, mengikuti story):

- **Toggle mode**: state `viewMode: 'card' | 'list'`; kontrol grup `Toggle` (`components/ui/toggle.tsx`, `aria-pressed`) di samping `SearchBar` dengan ikon lucide `LayoutGrid`/`List`, `aria-label` dari i18n (`archive:view.card`, `archive:view.list`).
- **Card mode** (`archive-card.tsx`, presentational, `interface ArchiveCardProps`): grid kartu `CARD_GRID_CLASS` (dari `@/components/shared/card-grid`). Tiap kartu menampilkan thumbnail (`aspect-video object-cover`; null → placeholder `bg-muted` + ikon `ImageOff` + `archive:card.noThumbnail`), judul (`line-clamp-2`), badge tipe + badge status (overlay `absolute left-2 top-2 z-10` di atas thumbnail, mengikuti story), badge kategori, dan tanggal publish (`formatDateTime`). Aksi Edit/Hapus **tombol terlihat** (bukan `DropdownMenu`, mengikuti `story-card.tsx`): `Button variant="outline"` + ikon `Pencil` (Edit) dan `Button variant="destructive"` + ikon `Trash2` (Hapus) dalam grid `mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2`, di-gate `canUpdate`/`canDelete` (label `archive:table.edit`/`archive:table.delete`).
- **List mode** (`archive-table.tsx`, presentational, props `interface`):
  - Kolom: `thumbnail` (img `size-10 rounded object-cover`; null → `—`), title (`name`), `categories` (badge list `Badge variant="secondary"`; kosong → `—`), `type` (badge `MEMBER`/`PUBLIC`), `status` (badge `DRAFT`/`REQUEST`/`APPROVED`/`PUBLISHED`), `publishedAt` (`formatDateTime`; null → `—`), `Aksi`.
  - `SortableHeader` **hanya** pada kolom yang masuk whitelist `sortBy` backend: `name`, `type`, `status`, `publishedAt`. Kolom `thumbnail`/`categories` **tidak** di-whitelist → header non-sortable (**pengecualian terdokumentasi**); kolom `Aksi` tidak sortable.
  - Badge status memetakan `ArchiveStatus` (`STATUS_VARIANT` dari `./status-variant.ts`, dipakai bersama card): `DRAFT` secondary, `REQUEST` outline, `APPROVED` default, `PUBLISHED` default. Badge tipe (`TYPE_VARIANT`): `PUBLIC` default, `MEMBER` secondary.
  - Kolom `Aksi` hilang bila `canUpdate` dan `canDelete` keduanya `false`; aksi pakai `DropdownMenu` (Edit/Hapus) seperti `user-table.tsx`.
- **Skeleton** menyesuaikan mode aktif: card = grid kartu, list = baris.
- **SearchBar** (`components/shared/search-bar.tsx`): placeholder `Cari judul atau deskripsi...`; debounce 300–500 ms via `useDebouncedValue`; `search` dikirim hanya bila `trim >= 2` char (`appendListParams`); ubah `search` → `setPage(1)`.
- **Sort**: klik header cycle `asc → desc → null` via `nextSort`; `sort` berubah → `setPage(1)`. Filter list (dropdown `type`/`status` via Select) mengirim `filter[type]`/`filter[status]`; perubahan filter → `setPage(1)`.
- **Pagination** (`DataTablePagination`): `Total N arsip · halaman P`.
- **Empty state**: bedakan **"Belum ada arsip"** vs hasil search nihil (`Tidak ditemukan untuk "<term>"`) + tombol **Reset** (`onResetSearch`).
- **Tombol "Tambah Archive"** → `navigate('/archives/new')`, di-gate `can('archive:create')`.
- **Aksi baris**: Edit → `navigate('/archives/:id/edit')`; Hapus → `AlertDialog` konfirmasi, di-gate `can('archive:delete')`.
- **Query**: `useArchives({ page, limit, search, sortBy, sortOrder, mine, filter })` → query key `['archive', { page, limit, search, sortBy, sortOrder, mine, filter }]`, `placeholderData: keepPreviousData`.
- **Scope `mine` (non-admin)**: halaman menentukan `isArchiveAdmin = canAny(['archive:approve','archive:reject','archive:publish','archive:unpublish'])`; non-admin mengirim `mine: true` (`?mine=true`) sehingga **hanya melihat arsip miliknya**, admin melihat **semua**. `mine` ikut di queryKey. Dashboard home memakai satu section arsip (semua yang boleh dibaca, **tanpa** "Arsip Saya"), dengan pagination untuk non-admin — lihat `docs/module/dashboard.md` §10c/§10d.
- **Error**: 403 (`isForbiddenError`) → empty-state "Tidak punya akses"; non-403 → banner `archive:errors.loadData`.
- **Toast**: via `@/lib/toast` + i18n `archive:toast.*`; hapus sukses → `toastSuccess(t('archive:toast.deleted'))`; gagal non-422 → `toastError(getApiErrorMessage(err, t('archive:toast.deleteFailed')))`; 422 tidak di-toast.

Contoh query: `/archives?page=1&limit=10&search=gamelan&sortBy=publishedAt&sortOrder=desc&filter[type]=PUBLIC&filter[status]=PUBLISHED`.

## 8. Halaman Editor Full-page 2 Section (`/archives/new` & `/archives/:id/edit`)

Satu komponen form dipakai ulang (`archive-form.tsx`, di-render oleh `archive-new.tsx`/`archive-edit.tsx`); edit memuat detail via `useArchive(id)` (`GET /archives/:id`) lalu menyerahkan `initialValues`. Editor **full-page** (bukan grid 70/30 story, bukan dialog). Karena editor memuat **detail**, ia **punya** `documents` (`Archive.documents` terisi) — berbeda dari list (§7) yang tidak menerimanya.

Layout: **scroll normal** per section (default), **bukan** rantai full-height `lg:h-svh lg:overflow-hidden` story. Alasan: form 2 section bisa lebih panjang dari viewport dan tidak ada panel kanan yang perlu scroll independen; halaman scroll natural lebih sederhana (YAGNI). Form full-page 2 section ini **dirender di dalam area konten AppShell standar** — **sidebar + navbar/header tetap tampil**, sama seperti halaman normal; **tidak** ada layout sidebar-hidden dan **tidak** perlu branch `lg:h-svh` khusus (pakai scroll halaman normal). Konten dibungkus `<form onSubmit>` dengan lebar terbatas (`mx-auto max-w-5xl`).

Struktur: **2 `Card`** dipisah `Separator`/jarak (`space-y-6`); tiap section punya header (`CardHeader` dengan `CardTitle`/`CardDescription` dari i18n).

### Section 1 — Informasi

Layout **2 kolom di dalam section** (`grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]`): **kiri = field teks**, **kanan = thumbnail upload**. Responsive: 1 kolom di mobile (`grid-cols-1`), 2 kolom di `md`+.

Field kiri (urut):
- **Judul** (`name`) — `Input`, wajib, `placeholder={t('archive:form.titlePlaceholder')}`.
- **Deskripsi** (`description`) — `Textarea` teks biasa (**bukan** rich text), opsional.
- **Tipe Arsip** (`type`) — `RadioGroup` shadcn horizontal (`flex flex-row gap-4`), opsi `MEMBER`/`PUBLIC` dari `ARCHIVE_TYPES`, tiap item `RadioGroupItem` + `Label` (`archive:typeOptions.*`), **default `PUBLIC`**.
- **Kategori** (`categoryIds`) — `category-combobox.tsx` multi-select + create inline (lihat poin Kategori).
- **Terbitkan** — **bukan** field inline. Tanggal/waktu terbit dipilih di **dialog `PublishScheduleDialog`** (shared) yang dibuka tombol **Terbitkan** di footer (lihat Status).

Field kanan: **Thumbnail** (`thumbnail`) — `thumbnail-upload.tsx` (upload `POST /images` `entityType='post'` atau dihilangkan via `useUploadImage`, **fungsi image yang tidak diubah**, preview varian `thumbnail` fallback `url`, tombol hapus, dropzone via `use-file-drop.ts`, mime PNG/JPEG/WebP max 5 MB). Field dikirim sebagai **`url` string absolut** (`null` untuk menghapus); **TIDAK** ada `imageIds`/binding Image di payload.

### Section 2 — Link & Dokumen

Berisi **dua blok terpisah** (mis. `Separator` + sub-heading):

**Link Eksternal** (`external-links-input.tsx`, reusable, presentational):
- Daftar baris input URL berurut (`<input type="url">` bergaya `Input`), tombol **Tambah Link** menambah baris kosong, tombol hapus (`Trash2`) per baris, validasi URL per baris (zod `url()`).
- State `externalLinks: string[]` berurut; nilai kosong dibuang saat submit.
- Opsional (boleh kosong). Payload `externalLinks` bila dikirim = replace seluruh array.

**Dokumen PDF** (`document-upload.tsx`, reusable, presentational, UX disamakan dengan `story/gallery-upload.tsx`):
- **Grid kartu** (`<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">`, tiap `<li>` `relative overflow-hidden rounded-md border bg-card`); empty state = kotak dashed (`archive:document.empty`).
- **Dropzone**: root container memasang `useFileDrop(handleFiles, disabled || isUploading)` + highlight `ring-2 ring-primary` saat `isDragging` (pola `thumbnail-upload.tsx`); tambah via klik lewat `<input type="file" multiple accept="application/pdf,.pdf">` tersembunyi + `Button variant="outline" size="sm"`.
- Setiap file diupload lewat **`use-upload-document`** (`UploadDocument` → `api/documents.ts` / `hooks/use-upload-document.ts`) → **`POST /documents`** (multipart field `file`, `application/pdf` only, max **10 MB**). **BUKAN** `use-upload-image`. Hasil (`{ id, url, key, filename, mimeType, size }`) di-append ke state `documents: ArchiveDocument[]`.
- **DUA fungsi upload TERPISAH**: `use-upload-image` (**hanya** thumbnail image, `POST /images`, **tidak diubah**) dan `use-upload-document` (dokumen PDF, `POST /documents`). Image upload tidak diubah.
- **Kartu dokumen (tanpa preview gambar)**: blok `aspect-square w-full` berupa `<a href={document.url} target="_blank" rel="noopener noreferrer">` berisi ikon `FileText` terpusat + `filename` ter-truncate + `formatFileSize(document.size)`; badge nomor urut (`top-1 left-1`) dan handle `GripVertical` (`top-1 right-1`). Baris aksi bawah: buka (`ExternalLink`), naik, turun, hapus (`Trash2`) — ukuran `size-7` mirror galeri.
- **Reorder DnD native** (tanpa dependency, identik `gallery-upload.tsx`): `draggable={!disabled}`; `onDragStart` set `dragIndex` + `dataTransfer.setData('text/plain', String(index))` + `effectAllowed='move'`; `onDragOver` `preventDefault` + `setOverIndex`; `onDrop` baca `dataTransfer` (fallback Firefox ke state) lalu `move(from, to)`; `onDragEnd` reset; opacity-50 saat dragged, `ring-2 ring-primary` pada target. Tombol keyboard naik/turun (`ArrowUp`/`ArrowDown`, `size-7`, `aria-label` `archive:document.moveUp/moveDown`, disabled di ujung) tetap ada sebagai alternatif.
- Payload `documentIds = documents.map(d => d.id)` **berurut**; saat edit selalu dikirim (termasuk `[]`) agar urutan/penghapusan diterapkan; saat create hanya bila non-kosong.

Section memakai `Card`/`Separator`; grid & responsive ringkas; **scroll normal** (default, lihat paragraf Layout). Semua styling memakai token design system; dilarang hardcode warna.

### Kategori

Perilaku **identik story**:
- Komponen `category-combobox.tsx` saat ini di `features/story/components/`; karena dipakai 2 fitur (story + archive), **pindahkan ke `components/shared/category-combobox.tsx`** dan update import story (satu baris) — **aksi refactor kecil**, dicatat di §14.
- Multi-select `Popover` + `Command`; memuat opsi via `GET /categories?filter[type]=ARCHIVE&limit=100` (gate `category:read`).
- Input "tambah kategori baru" → `POST /categories { name, type: 'ARCHIVE' }` (idempotent) lalu auto-select; gate `canCreate` = `category:create`.
- Hasil disimpan sebagai `categoryIds`.

### Status & Workflow (submit/approve/reject)

- **Tidak ada Select `status`** di Section 1. Status/transisi ditentukan lewat **tombol aksi** di footer + **bar workflow** di atas form (pola sama Event, `size="sm"`). Status: `DRAFT | REQUEST | APPROVED | PUBLISHED`.
- **Simpan sebagai Draft** (`variant="outline"`, ikon `Save`, `action 'save'`) — selalu tampil; label `archive:form.saveAsDraft` saat `status === 'DRAFT'`, selain itu `archive:form.save`.
- Tombol **Simpan sebagai Draft** tambahan (`action 'draft'`) tampil saat `status === 'PUBLISHED'` atau (`canPublishArchive && status === 'APPROVED'`) → menurunkan ke `DRAFT` (konfirmasi `archive:confirm.*`).
- **Terbitkan** (ikon `CalendarClock`, `action 'publish'`, `canPublishArchive && status !== 'REQUEST'`) → validasi form lalu buka **`PublishScheduleDialog`**; konfirmasi memanggil submit `publish` + `publishedAt` ISO.
- **Ajukan untuk Terbit** (ikon `Send`, `action 'request'`, `!canPublishArchive && canSubmitArchive && status === 'DRAFT'`) → konfirmasi `archive:confirm.*` lalu submit `request`.
- **Bar `status === 'REQUEST'`** (full-width, `archive:workflow.requested`) menampilkan:
  - **Tolak** (`canRejectArchive`, ikon `X`) → AlertDialog konfirmasi → `action 'reject'` (endpoint `POST /archives/:id/reject`).
  - **Setujui** (`canApproveArchive`, ikon `Check`) → buka `PublishScheduleDialog` → `action 'approve'` (endpoint `POST /archives/:id/approve` + `publishedAt`).
- Submit form default (mis. tekan Enter) = `action 'save'` (mempertahankan `status` form; draft tetap draft) — tidak pernah tiba-tiba Terbit.
- **`publishedAt` dikirim hanya ketika** ada override (approve/publish, ISO) **atau** `status === 'PUBLISHED'` (mempertahankan tanggal lama / `now`). `DRAFT`/`REQUEST` **OMIT total** (backend memaksa `PUBLISHED` begitu menerima tanggal non-null).
- Simpan konten = `POST /archives` (create) / `PATCH /archives/:id` (edit); transisi = endpoint `/submit`, `/approve`, `/reject` (lihat §6, §10).

### Aksi

- Tombol **Batal**, aksi status (Simpan sebagai Draft / Ajukan untuk Terbit / Terbitkan / Tolak / Setujui) di footer & bar workflow (`disabled={isPending}`); sukses → toast (`archive:toast.created`/`updated`/`approved`/`rejected`) + redirect `/archives`.
- Aksi submit/approve/reject di-gate permission `archive:submit`/`archive:approve`/`archive:reject` (via props `canSubmitArchive`/`canApproveArchive`/`canRejectArchive`); simpan konten di-gate gate form existing (`archive:create`/`archive:update`).
- 422 → `form.setError` per-field, **tetap di halaman** (tanpa toast, tanpa redirect).
- Binding thumbnail (`thumbnail` URL), dokumen (`documentIds`) & link (`externalLinks`) selalu dikirim saat edit (termasuk `[]` untuk array) agar replace seluruh array diterapkan; `thumbnail` `null` menghapus.

## 8a. Halaman Detail (`/archives/:id`) — layout "katalog dokumen"

Detail read-only dirender oleh `features/archive/components/archive-detail.tsx` (`ArchiveDetailProps { archive: Archive; className?: string }`, `className` via `cn()`). Layout sengaja **dibedakan** dari `story-detail` (hero full-bleed 21/9 + satu kolom) dan `event-detail` (hero + konten kiri 2/3 / info sticky kanan 1/3):

- **Shell grid** `lg:grid-cols-[18rem_1fr]` dengan posisi **terbalik** dari event: **kiri = panel metadata/cover (sticky `lg:top-8`)**, **kanan = konten utama**. **Tanpa** hero full-bleed.
- **Panel kiri** (sticky): thumbnail sebagai **cover rasio 4/3** (`aspect-[4/3] object-cover`; null → `bg-muted` + ikon `ImageOff`, label `archive:card.noThumbnail` tidak dipakai di sini), lalu `Card` metadata berlabel: `Tipe` (badge `TYPE_VARIANT`), `Status` (badge `STATUS_VARIANT`), `Kategori` (chip `Badge variant="secondary"`), `Penulis` (`creator.fullName`), `Tanggal terbit` (`formatDateTime`). Dibungkus `Card`/`CardHeader`/`CardContent` + `Separator` shadcn.
- **Kolom kanan**: `h1` besar → Deskripsi → Link Eksternal (**chip/row** + ikon `Link2`) → Dokumen sebagai **daftar file bernomor ber garis** (`divide-y` di dalam `rounded-lg border`; tiap baris: nomor indeks + ikon `FileText` + nama file (`truncate`) + ukuran `formatFileSize(document.size)` + tombol Buka). Bukan kumpulan `Card` seperti layout sebelumnya.
- **Mobile**: satu kolom; urutan DOM `header` (judul) → `aside` (cover + metadata) → isi utama, sehingga cover/metadata muncul **setelah judul**.
- i18n key baru di `archive:detail`: `metadata`, `type`, `status`, `categories`, `creator`, `publishedAt`, `index` — ditambahkan di **kedua** file `src/i18n/locales/{en,id}/archive.json`.
- **Skeleton** route `archive-detail.tsx` disesuaikan meniru grid yang sama (judul kanan, panel cover/metadata kiri sticky, blok konten kanan).

## 9. Form & Validasi

- **RHF + zod**; schema di `lib/schema.ts`, dibungkus `useMemo(..., [t])`; pesan hanya dari `t('validation:*')`.
- Mirror DTO backend:
  - `name`: wajib, `trim`, max 200.
  - `description`: opsional (string).
  - `thumbnail`: opsional (URL string) — nullable untuk hapus; **tidak ada** `imageIds`.
  - `type`: enum `ArchiveType` (`MEMBER`/`PUBLIC`, default `PUBLIC`).
  - `status`: enum `ArchiveStatus` (`DRAFT`/`REQUEST`/`APPROVED`/`PUBLISHED`) — **tidak** di-render sebagai field; nilainya di-override saat submit oleh tombol aksi (Simpan sebagai Draft / Ajukan untuk Terbit / Terbitkan / Setujui / Tolak), bukan input user.
  - `publishedAt`: ISO string (default `''`) — **tidak** di-render sebagai field inline; diisi dari dialog `PublishScheduleDialog` saat Terbitkan (override) atau dari detail saat edit. Hanya dikirim ketika `status === 'PUBLISHED'`; `DRAFT` tidak mengirim field ini sama sekali.
  - `categoryIds`: opsional `string[]`.
  - `externalLinks`: opsional `string[]` (validasi `url()` per item).
  - `documentIds`: opsional `string[]` (diisi dari state `documents`, bukan input user langsung).
- **Validasi upload (client-side, sebelum kirim):** thumbnail image mime png/jpeg/webp + max **5 MB**; dokumen PDF mime `application/pdf` + max **10 MB**. File di luar itu ditolak di komponen (`document-upload.tsx`/`thumbnail-upload.tsx`) dan menampilkan error i18n — **bukan** error 422 dari server. Key: `archive:document.uploadTooLarge` (PDF > 10 MB) & `archive:document.uploadInvalid` (mime/format salah); thumbnail `archive:thumbnail.uploadInvalid`.
- Map 422 via `mapApiFieldErrors` (`@/lib/field-errors`) → `useEffect` + guard `isValidationError(err)` → `form.setError(field, { message })`.
- Setiap field punya `<FormMessage />` **kosong**.
- **Banner error hanya non-422** (409/500/network); 422 tampil per-field, tanpa toast.
- Placeholder field: judul `archive:form.titlePlaceholder`; search `archive:search.placeholder`.

## 10. Permissions

| Route / Aksi | Kode dibutuhkan |
| --- | --- |
| Route `/archives` (list) | `archive:read` (via `RequirePermission`; tanpa akses → `/403`) |
| Route `/archives/:id` (detail) | `archive:read` |
| Route `/archives/new` (editor create) | `archive:create` dicek di dalam komponen |
| Route `/archives/:id/edit` (editor edit) | `archive:update` dicek di dalam komponen |
| Tombol "Tambah Archive" | `archive:create` |
| Aksi Edit baris | `archive:update` |
| Aksi Hapus baris + `DELETE /archives/:id` | `archive:delete` |
| Ajukan untuk Terbit (`POST /archives/:id/submit`) | `archive:submit` |
| Setujui (`POST /archives/:id/approve`) | `archive:approve` |
| Tolak (`POST /archives/:id/reject`) | `archive:reject` |
| Terbitkan langsung (`action 'publish'`, `PATCH` `status: PUBLISHED`) | `archive:publish` |
| Upload thumbnail (`POST /images`, fungsi image tak diubah) | **Bukan** `archive:*` — permission tetap `story:create\|story:update\|event:create\|event:update`. Aktor perlu salah satu izin image-upload; admin punya semua. Aktor arsip-saja butuh `story:create/update` (upgrade path §14) |
| Upload dokumen PDF (`POST /documents`, endpoint terpisah) | `archive:create` / `archive:update` (backend; ANY-of) |
| Pemilihan kategori (`GET /categories`) | `category:read` |
| Tambah kategori baru (`POST /categories`) | `category:create` |
| Menu sidebar "Archives" | `archive:read` (terlihat oleh pemegang `archive:read`; sama dengan gate route list) |

- Gate tombol via `can(...)` dari `useAuthPermissions()`; gate route list via `RequirePermission`.
- **Catatan**: `archive:read` menggate akses list/detail, tetapi **scope baris** bergantung permission workflow: pemegang salah satu `archive:approve`/`reject`/`publish`/`unpublish` (approver/admin) melihat **SEMUA** arsip; selain itu hanya arsip **miliknya** (`mine=true`). `type` `MEMBER`/`PUBLIC` hanyalah **label**, bukan gate. Role member & organization punya `archive:read`.
- Tanpa izin create/update, editor menampilkan empty-state/redirect internal (mis. ke `/archives`) dengan pesan — tidak memanggil mutation.

## 11. i18n

- Namespace baru **`archive`**; file `src/i18n/locales/{en,id}/archive.json`.
- Daftarkan di `src/i18n/index.ts` (import resources + tambah ke `resources.en`/`resources.id` + array `ns`).
- Tambah key `dashboard:nav.archives` di `{en,id}/dashboard.json`.

Key yang direncanakan:

```
archive:title
archive:subtitle
archive:add
archive:search.placeholder / archive:search.ariaLabel
archive:view.{card,list}
archive:table.{thumbnail,title,categories,type,status,publishedAt,empty,notFound,reset,edit,delete}
archive:card.{noThumbnail}
archive:typeOptions.{MEMBER,PUBLIC}
archive:statusOptions.{DRAFT,REQUEST,APPROVED,PUBLISHED}
archive:form.{sectionInfo,sectionLinks,titleLabel,titlePlaceholder,descriptionLabel,type,categories,categoryPlaceholder,categorySearch,categoryAdd,categoryCreating,categoryEmpty,thumbnail,externalLinks,externalLinksEmpty,externalLinksPlaceholder,externalLinksAdd,externalLinksRemove,documents,save,saveAsDraft,requestPublish,publish,cancel}
archive:publishDialog.{title,description,dateLabel,datePlaceholder,next,confirmTitle,confirmDescription,confirm}
archive:workflow.{requested,approve,reject}
archive:confirm.{title,description,submit}
archive:document.{add,empty,formats,uploading,uploadTooLarge,uploadInvalid,remove,moveUp,moveDown,open,size}
archive:thumbnail.{upload,uploading,remove,formats,uploadInvalid}
archive:detail.{back,description,externalLinks,documents,empty}
archive:delete.{title,description}
archive:errors.{loadData,forbidden,loadCategories,loadDetail,uploadFailed,noCreatePermission,noUpdatePermission}   # tanpa loadDocuments — dokumen ikut detail archive
archive:toast.{created,updated,deleted,createFailed,updateFailed,deleteFailed,approved,rejected,approveFailed,rejectFailed}
```

Key validasi ditambahkan ke namespace **`validation`** (`archiveNameRequired`, `archiveNameMax`, `archiveUrlInvalid`, `archiveTypeInvalid`, `archiveStatusInvalid`, dst.).

Catatan key upload: `archive:document.uploading` (indikator transfer), `archive:document.uploadTooLarge` (PDF > **10 MB**, cek client-side di `document-upload.tsx`), `archive:document.uploadInvalid` (mime PDF salah / file corrupt — tampil di komponen, bukan toast), `archive:errors.uploadFailed` (pesan error **non-422** 500/502/network di komponen). Dua jalur upload terpisah: thumbnail (`archive:thumbnail.*`) via `use-upload-image`, dokumen (`archive:document.*`) via `use-upload-document`. Key final diserahkan implementasi; yang penting tercatat di rencana.

## 12. Toast Feedback

- Sukses/gagal: `archive:toast.created/updated/deleted` + `archive:toast.createFailed/updateFailed/deleteFailed` (via `t()`, tanpa hardcode).
- Helper `@/lib/toast`: `toastSuccess` di `onSuccess`; `toastError(getApiErrorMessage(err, t('archive:toast.*Failed')))` di `onError`.
- 422 → early-return `if (isValidationError(err)) return;` (per-field, tanpa toast, tetap di halaman).
- Upload terpisah: thumbnail via `POST /images` (`use-upload-image`) dan dokumen PDF via `POST /documents` (`use-upload-document`). Sukses tidak perlu toast utama (tidak invalidate list archive). Error non-422 (500/502/network) → `toastError(getApiErrorMessage(err, t('archive:errors.uploadFailed')))`. Ukuran/mime salah (PDF > 10 MB, gambar > 5 MB, mime salah) dicek **client-side** → early-return tanpa toast, pesan tampil di komponen (`archive:document.uploadTooLarge`/`archive:document.uploadInvalid`/`archive:thumbnail.uploadInvalid`); bila server tetap membalas 422 → early-return tanpa toast.
- `<Toaster/>` sudah mount sekali di `src/app/providers.tsx`.

## 13. Konvensi (AGENTS.md)

- Query key domain `['archive', ...]` + `['categories', { type: 'ARCHIVE' }]`; `placeholderData: keepPreviousData` untuk list.
- Mutation invalidate key terkait di `onSuccess` (`['archive']`, `['archive', { id }]`, `['categories']`); toast di call-site page, bukan hook. **Upload thumbnail (`use-upload-image`) dan dokumen (`use-upload-document`) tidak invalidate list archive** (aset belum terikat sampai simpan).
- `url` gambar/dokumen dari API selalu absolut (S3/CDN) — jangan prefix base URL/proxy saat render `<img src>`/tautan dokumen.
- Komponen **presentational**: data via props (`interface`), tanpa fetch langsung, tanpa import lintas domain (hanya `components/ui`, `components/shared`, `lib`, `i18n`).
- Tanpa `any` di boundary API, tanpa `@ts-ignore`.
- Tanggal via `formatDateTime`/`formatDate` dari `@/lib/datetime`; input tanggal lewat `DateTimePicker`; kirim ISO 8601 UTC.
- Bahasa UI Indonesia; semua string UI via i18n.
- File baru + update route/sidebar minimal (satu entri nav). Archive **tidak menyentuh** `app-shell.tsx`: **tidak** ada `isArchiveEditor`, **tidak** ada generalisasi branch editor story/event, dan **tidak** ada layout sidebar-hidden. Editor create/edit tampil **di dalam layout ber-sidebar/navbar** seperti halaman biasa (lihat §2 & §14).

## 14. Status & Catatan

- **Status**: **workflow submit/approve/reject diimplementasikan** (mirror Event). `ArchiveStatus` = `DRAFT | REQUEST | APPROVED | PUBLISHED`; `ArchiveFormAction` = `save | draft | request | publish | approve | reject | unpublish`; hooks `use-submit-archive`/`use-approve-archive`/`use-reject-archive`; endpoint `POST /archives/:id/{submit,approve,reject}`. Verifikasi end-to-end tetap menunggu backend `archive` siap.
- **Verifikasi implementasi nanti** (catat seperti `story.md`): `pnpm lint`, `pnpm exec tsc -p tsconfig.app.json --noEmit` (catatan: `pnpm tsc --noEmit` **no-op** karena `tsconfig.json` `files: []` — gunakan perintah `-p tsconfig.app.json`), `pnpm build`.
- **Dependency**: TIDAK ada dependency baru (tanpa TipTap/dompurify). Upload **DUA fungsi TERPISAH**: thumbnail image via `uploadImage`/`useUploadImage` (`POST /images`, **tidak diubah**) dan dokumen PDF via `uploadDocument`/`useUploadDocument` (`POST /documents`, `fetch`/`FormData`); reorder dokumen via tombol keyboard (DnD native opsional).
- **Design correction (dua fungsi upload terpisah)**: image upload (`POST /images`, `api/images.ts:uploadImage`, `hooks/use-upload-image.ts:useUploadImage`) **unchanged** dan dipakai **hanya** untuk thumbnail (disimpan sebagai **string URL**, tanpa `imageIds`/binding Image). `POST /images` memakai `entityType` default `'post'` (atau dihilangkan) — **bukan** `'archive'` — dan permission-nya **tidak berubah** (`story:create|story:update|event:create|event:update`; `archive:*` **tidak** menggate image). **Caveat**: karena `archive:*` tidak menggate `POST /images`, upload thumbnail memerlukan aktor yang memegang izin image-upload — admin punya semua; aktor **arsip-saja** perlu `story:create`/`story:update` (**upgrade path**: beri izin image-upload khusus archive atau perluas permission `POST /images` di backend bila arsip-saja adalah kasus nyata). Dokumen PDF memakai **endpoint & fungsi TERPISAH**: `POST /documents`, `api/documents.ts:uploadDocument`, `hooks/use-upload-document.ts:useUploadDocument` — `application/pdf` only, max **10 MB**, response `{ data: { id, url, key, filename, mimeType, size }, message }`, permission `archive:create` OR `archive:update`, `url` absolut S3. Thumbnail memakai `UploadedImage` shared apa adanya; dokumen memakai tipe **lokal** `ArchiveDocument` interface eksplisit (`mimeType`/`size` nullable, tanpa `width`/`height`/`variants`). `imageIds` **dihapus** dari `CreateArchiveInput`/`UpdateArchiveInput` dan dari payload. **Tidak ada perubahan tipe shared** `src/types/image.ts` (width/height tetap non-null) sehingga story/event tidak bergetar/ripple. `document-upload.tsx` memakai `use-upload-document`; payload dokumen mengirim `documentIds = documents.map(d => d.id)` berurut (replace saat update).
- **Refactor kecil**: pindah `features/story/components/category-combobox.tsx` → `components/shared/category-combobox.tsx` + update 1 import di story (dipakai 2 fitur). Tidak ada perubahan perilaku story.
- **Pengecualian terdokumentasi**: kolom `thumbnail`/`categories` di tabel tidak sortable karena tidak ada di whitelist `sortBy` backend.
- **Perbedaan utama vs story**: (1) resource `archive` model terpisah, **bukan** `Post`; (2) editor full-page 2 section, bukan grid 70/30; (3) deskripsi `Textarea` teks biasa, bukan rich text; (4) **workflow approval mirip Event** — status `DRAFT | REQUEST | APPROVED | PUBLISHED` via tombol aksi + bar `REQUEST`, **tanpa Select status**; (5) `documents`/`externalLinks` sebagai array berurut (replace saat update).
- **Batasan iterasi**: menghapus dokumen dari form **tidak** menghapus aset di S3 (tidak ada endpoint delete) → aset orphan. Catat sebagai **TODO cleanup backend**; bukan tanggung jawab FE iterasi ini.
- **Asumsi yang belum dispesifikasi** (tercatat untuk konfirmasi arsitek): (a) field `sortBy`/`filter` list `archive` mengikuti whitelist yang diberikan; (b) respons `POST /images` = `ImageResponse` penuh (`{ id, url, key, filename, mimeType, size, width, height, variants }`) untuk **thumbnail**, sedangkan respons `POST /documents` = `{ id, url, key, filename, mimeType, size }` untuk **PDF** (dipetakan ke `ArchiveDocument`); (c) detail route `/archives/:id` opsional — didaftarkan dengan layout bare, boleh ditunda tanpa mengubah list/editor.

### Koreksi hasil review (revisi dokumen ini)

1. **Nav group**: item **Archives** masuk `dashboardNavItems` (bersebelahan dengan **Story**), **bukan** `dataManagementNavItems` (§2). Editor create/edit route (`/archives/new`, `/archives/:id/edit`) memakai **AppShell normal** — sidebar + navbar/header tetap tampil, form ter-render di `<Outlet/>`. Archive **tidak menyentuh** `app-shell.tsx`, **tanpa** `isArchiveEditor`, **tanpa** generalisasi branch editor story/event (§2, §13).
2. **`UpdateArchiveInput`**: tidak lagi hanya `extends Partial<CreateArchiveInput>` — **override** `thumbnail?: string | null` agar penghapusan thumbnail (`null`) dapat diekspresikan, mirror `UpdateArchiveDto` (`undefined` = jangan sentuh) (§3).
3. **Tipe dokumen = `ArchiveDocument` (interface lokal eksplisit)**: dokumen memakai tipe **lokal** `ArchiveDocument` (interface eksplisit `{ id, url, key, filename, mimeType: string | null, size: number | null }`, bukan `UploadedDocument` terpisah, bukan `UploadedImage` penuh, **bukan** `Pick<UploadedImage,...>` yang menghasilkan `mimeType`/`size` non-null). **Tidak ada perubahan tipe shared** `src/types/image.ts` — `width`/`height` tetap non-null; story/event tidak bergetar (§3, §6).
4. **Dokumen hanya di detail**: `GET /archives` **tidak** mengembalikan `documents`; `Archive.documents` dibuat **opsional** dan hanya terisi di `GET /archives/:id`. Halaman list (§7) tidak mengharapkan/menampilkan dokumen; editor (§8) memuat detail sehingga punya dokumen.
5. **i18n**: key `archive:errors.loadDocuments` **dihapus** — tidak ada endpoint load dokumen terpisah; dokumen ikut response detail archive (§11).
6. **Nama konstanta shared** diperbaiki: `card-grid.tsx` → **`card-grid.ts`** (§5).
7. **Ejaan**: role seed ditulis **`organization`**, bukan `organisation` (§10).
8. **Alur upload — DUA fungsi TERPISAH (koreksi desain dari product owner)**: thumbnail image via `POST /images` (`api/images.ts:uploadImage` / `use-upload-image.ts:useUploadImage`) yang **TIDAK diubah** dan disimpan sebagai **string URL** (`thumbnail`); dokumen PDF via endpoint **TERPISAH** `POST /documents` (`api/documents.ts:uploadDocument` / `hooks/use-upload-document.ts:useUploadDocument`, `application/pdf` max **10 MB**, permission `archive:create` OR `archive:update`) → `{ data: { id, url, key, filename, mimeType, size }, message }`. Payload archive hanya `documentIds = documents.map(d => d.id)` **berurut** (§6, §8).
9. **Restore endpoint/fungsi dokumen terpisah**: `POST /documents`, `api/documents.ts`, `use-upload-document` **dikembalikan**; image upload **tidak diubah** (thumbnail-only). `document-upload.tsx` memanggil `use-upload-document`. Tidak ada dependency baru (§3, §4, §6, §8, §14).
10. **`imageIds` DIHAPUS** dari `CreateArchiveInput`/`UpdateArchiveInput` dan dari payload — thumbnail cukup **URL string** (tanpa binding Image). `documentIds` tetap untuk dokumen (§3, §6, §8, §9).
11. **`ArchiveDocument` tipe lokal, tanpa perubahan tipe shared**: `UploadedImage` (`src/types/image.ts`, dipakai story/event) **tidak disentuh** — `width`/`height` tetap non-null. Dokumen PDF memakai `ArchiveDocument` (interface lokal eksplisit, `mimeType`/`size` nullable) sehingga ketergantungan nullable PDF hilang tanpa memakai `Pick` yang menghasilkan non-null (§3, §6, §14).
12. **Koreksi terbaru — image & document upload dipisah**: membatalkan keputusan "reuse image upload untuk PDF". `POST /documents` + `api/documents.ts` + `use-upload-document` **dipulihkan**; tabel/endpoint dokumen dipisah dari image; `use-upload-image` **hanya** untuk thumbnail dan **tidak diubah**. Response dokumen = `{ id, url, key, filename, mimeType, size }` (`url` absolut S3); tabel arsip/list tetap tanpa `documents` (hanya detail) (§3, §4, §6, §8, §9, §11, §14).
13. **Design correction — editor full-page TANPA sidebar-hidden (koreksi desain dari product owner)**: route `/archives/new` & `/archives/:id/edit` **memakai AppShell normal** — sidebar + navbar/header **tetap tampil**; form 2 section dirender di dalam area konten `<Outlet/>` seperti halaman biasa. **TIDAK ada** branch editor/sidebar-hidden di `app-shell.tsx` untuk Archive, **tidak perlu** `isArchiveEditor`, dan **tidak perlu** generalisasi pola biner `isStoryEditor`/`isEventEditor` (Archive tidak menyentuh `app-shell.tsx`). Tidak ada layout `lg:h-svh lg:overflow-hidden` khusus — halaman memakai **scroll normal**. Item nav **Archives** tetap di `dashboardNavItems` (sidebar tetap tampil) dan route list `/archives` normal (§2, §8, §10, §13).
14. **UX status — Select diganti dua tombol aksi (koreksi desain)**: Select `status` `DRAFT`/`PUBLISHED` di Section 1 **dihapus**; status kini ditentukan tombol **Simpan sebagai Draft** (`status: 'DRAFT'`) dan **Terbitkan** (`status: 'PUBLISHED'`) di footer, pola sama Story/Event (`size="sm"`), keduanya submit RHF form yang sama (`form.handleSubmit((values) => onSubmit(buildPayload(values, status)))`) dan di-gate gate form existing (`archive:create`/`archive:update`, tanpa permission baru). `publishedAt` tidak lagi field inline — dipilih lewat dialog `PublishScheduleDialog` yang dibuka tombol **Terbitkan**; `PUBLISHED` selalu mengirim ISO (`override || values.publishedAt || now`), `DRAFT` **omit** (backend memaksa PUBLISHED bila tanggal non-null). i18n baru: `archive:form.saveAsDraft` & `archive:form.publish` (en/id, key-set identik) + `archive:publishDialog.*` (8 key, termasuk `next`/`confirmTitle`); `archive:form.publishedAt`/`publishedAtPlaceholder` dihapus. Submit default (Enter) = Simpan sebagai Draft (§1, §8, §9, §11).
