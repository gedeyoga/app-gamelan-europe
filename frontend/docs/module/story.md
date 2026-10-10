# Module: Story — Brief

Dokumen ini mencatat rencana desain/implementasi halaman **Story** pada frontend React — list story + editor create/edit dengan rich text editor. Mengikuti konvensi `AGENTS.md` frontend dan format brief `docs/module/dashboard.md`, meniru pola List CRUD modul `user` dan `roles`.

> **Status dokumen**: ini **brief** (rencana), bukan laporan implementasi. Backend modul `posts`/`categories` **belum diimplementasikan** (modul/migration masih `TODO`); upload gambar **disiapkan backend memakai Amazon S3** dengan metadata di tabel `images` — endpoint di bawah mengikuti kontrak arsitek di `backend/docs/modules/story.md`. Implementasi frontend disusun terhadap kontrak tersebut; verifikasi end-to-end menunggu backend siap.

## 1. Tujuan & Ruang Lingkup

- Menyediakan pengelolaan **Story** (resource backend = `posts`) untuk admin/editor: daftar story (pagination/search/sort/filter), tambah, edit, hapus.
- Menu frontend bernama **Story**; resource backend tetap `posts` (`Post`, `PostCategory`, `Category`).
- Editor memakai **rich text editor ala blog/Medium** (HTML disimpan ke field `content`) dengan panel metadata (judul, slug, thumbnail, status, kategori) termasuk **tambah kategori langsung** dari halaman editor.
- Mengonsumsi API backend prefix global `/api/v1` (`lib/api-client.ts`), endpoint butuh JWT Bearer (di-attach otomatis).
- **Di luar lingkup iterasi ini**: preview publik dan audit log — mengikuti kontrak backend yang ada (`ContentStatus`), tanpa workflow tambahan di FE. **Alur approval/request status Story termasuk lingkup** (lihat §8: dropdown Simpan + bar Setujui/Tolak).

## 2. Routing

- Route didaftarkan di `src/app/routes/index.tsx`, sebagai child di bawah `DashboardLayout` (yang sudah `ProtectedRoute`).
- Route **list** dibungkus `<RequirePermission code="story:read">`; route **create/update** cek permission (`story:create`/`story:update`) di **dalam komponen** editor (gate isi halaman, bukan redirect seluruh route).
- Semua route statis berbagi prefix `/stories`.
- **Sidebar disembunyikan pada route editor**: `AppShell` (`app-shell.tsx`) mendeteksi `isStoryEditor` (`pathname === '/stories/new' || /^\/stories\/[^/]+\/edit$/`) dan merender branch khusus **tanpa** `SidebarProvider`/`AppSidebar`/`SidebarInset`/`SidebarTrigger` — hanya header ringkas (breadcrumb Dashboard / Story / judul + `LanguageSwitcher` + `ThemeToggle`) lalu `<main>` berisi `<Outlet/>`. Route list `/stories` tetap memakai sidebar. Deteksi murni `pathname` (tanpa mekanisme config baru).

```
/                      (parent → DashboardLayout, ProtectedRoute)
├── /stories            → list (tabel)         — RequirePermission code="story:read"
├── /stories/new        → editor create         — gate story:create di komponen
├── /stories/:id/edit   → editor edit           — gate story:update di komponen
└── /stories/:id        → detail (read-only)    — gate story:read di komponen (layout bare)
```

Registrasi memakai peringkat React Router: `stories/new` (segmen statis) tetap menang atas `stories/:id` (dinamis), dan `stories/:id/edit` beda jumlah segmen — tidak ada konflik.

Contoh bentuk pendaftaran:

```tsx
// src/app/routes/index.tsx (child di bawah dashboard)
{ path: 'stories', element: (<RequirePermission code="story:read"><StoriesPage /></RequirePermission>) },
{ path: 'stories/new', element: <StoryNewPage /> },
{ path: 'stories/:id/edit', element: <StoryEditPage /> },
{ path: 'stories/:id', element: <StoryDetailPage /> },
```

### Navigasi sidebar

- Tambah item **Story** ke grup **Data Management** di `src/features/dashboard/components/app-shell.tsx` (`dataManagementNavItems`), ikon lucide `Newspaper` (alternatif `FileText`), `url: '/stories'`, `permission: 'story:read'` (menu tampil untuk siapa pun yang punya `story:read` — termasuk `member`; gate route `/stories` tetap `story:read`).
- Label dari i18n: `dashboard:nav.story` (tambah key di `src/i18n/locales/{en,id}/dashboard.json`).
- Penyaringan menu memakai `isNavVisible` + `can` yang sudah ada (`app-shell.tsx`) — tidak perlu mekanisme baru.

## 3. Struktur File yang Direncanakan

```
src/app/routes/
├── stories.tsx          # halaman list (state page/search/sort, mutation, dialog hapus)
├── story-new.tsx        # halaman create (container form editor)
├── story-edit.tsx       # halaman edit (container form editor, load detail)
└── story-detail.tsx     # halaman detail read-only (gate story:read, layout bare)

src/features/story/
├── api/
│   ├── posts.ts         # listPosts, getPost, createPost, updatePost, deletePost
│   ├── categories.ts    # listCategories, createCategory
│   └── images.ts        # uploadImage (multipart → POST /images, S3)
├── hooks/
│   ├── use-stories.ts          # query ['story', {page,limit,search,sortBy,sortOrder}], keepPreviousData
│   ├── use-story.ts            # query ['story', {id}] (detail edit)
│   ├── use-create-story.ts     # mutation → invalidate ['story'] (+ kirim imageIds)
│   ├── use-update-story.ts     # mutation → invalidate ['story'] (+ ['story', {id}], kirim imageIds gambar baru)
│   ├── use-delete-story.ts     # mutation → invalidate ['story']
│   ├── use-categories.ts       # query ['categories', { type: 'STORY' }], staleTime ≥ 60s
│   ├── use-create-category.ts  # mutation POST /categories → invalidate ['categories']
│   └── use-upload-image.ts     # mutation POST /images (thumbnail & sisip gambar editor; tanpa invalidate list)
├── components/
│   ├── story-table.tsx         # presentational tabel + aksi baris
│   ├── story-card.tsx          # presentational kartu (mode Card)
│   ├── story-detail.tsx        # presentational detail read-only (hero + konten HTML + galeri)
│   ├── story-gallery.tsx       # presentational galeri read-only + lightbox (Dialog)
│   ├── status-variant.ts       # peta ContentStatus → Badge variant (dipakai tabel + kartu)
│   ├── rich-text-editor.tsx    # TipTap (toolbar + konten HTML + sisip gambar)
│   ├── story-meta-panel.tsx    # panel kanan: judul/slug/thumbnail/galeri/flyer/kategori
│   ├── category-combobox.tsx   # multi-select + tambah kategori baru
│   ├── thumbnail-upload.tsx    # upload + preview + hapus + dropzone
│   ├── gallery-upload.tsx      # galeri/flyer multiple + reorder (native DnD + keyboard) + dropzone (prop `i18nPrefix`)
│   └── flyer-media-panel.tsx   # blok media flyer BERTIPE: chip tipe + satu `GalleryUpload` per tipe (presentational)
└── types.ts                    # Story, StoryCategory, Creator, ContentStatus, UploadedImage, CreateStoryInput, UpdateStoryInput
```

`types.ts` (rancangan):

```ts
export type ContentStatus = 'DRAFT' | 'REQUEST' | 'APPROVED' | 'PUBLISHED'
export type CategoryType = 'STORY' | 'ARCHIVE'

export interface StoryCategory { id: string; name: string; type: CategoryType }
export interface Creator { id: string; fullName: string }

export interface ImageVariant {
  name: 'large' | 'medium' | 'thumbnail'
  url: string        // absolut S3/CDN
  key: string
  width: number
  height: number
  size: number
  mimeType: string
}

export interface UploadedImage {
  id: string
  url: string        // varian `large` (default delivery), absolut S3/CDN
  key: string        // original
  filename: string
  mimeType: string
  size: number
  width: number
  height: number
  variants: ImageVariant[]  // PNG/JPEG/WebP; GIF tidak didukung
}

export interface FlyerGroup {
  type: string               // teks bebas: trim, min 1, max 40; unik (case-insensitive)
  images: UploadedImage[]    // berurut
}

export interface Story {
  id: string
  name: string
  slug: string
  status: ContentStatus
  visibility: Visibility       // 'PUBLIC' | 'PRIVATE', default PUBLIC
  publishedAt: string | null
  content?: string
  thumbnail: string | null
  categories: StoryCategory[]
  creator: Creator | null
  gallery: UploadedImage[]   // GET /posts/:id — berurut
  flyer: FlyerGroup[]        // GET /posts/:id — berurut; tiap grup = { type, images[] }
  createdAt: string
  updatedAt: string
}

export interface CreateStoryInput {
  name: string
  slug?: string
  content?: string
  thumbnail?: string
  status?: ContentStatus
  visibility?: Visibility     // default PUBLIC bila di-omit
  categoryIds?: string[]
  imageIds?: string[]         // id Image (hasil POST /images) yang dipakai: inline + thumbnail
  galleryImageIds?: string[]  // id galeri berurut; bila dikirim = replace seluruh galeri
  flyerItems?: { type: string; imageIds: string[] }[]  // grup flyer berurut; bila dikirim = replace seluruh grup flyer
}
export interface UpdateStoryInput extends Partial<CreateStoryInput> {}
```

## 4. Dependency Baru

Rich text editor memakai **TipTap** (WYSIWYG, inline-image). `contenteditable`/`document.execCommand` **tidak dipakai** (deprecated, tidak konsisten antar-browser). Install via pnpm:

```
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder @tiptap/extension-text-align
```

- Alasan: butuh menyisipkan `<img>` di posisi cursor, toolbar format, dan output HTML string yang cocok dengan field `content` backend.
- Tidak menambah dependency lain (upload via `fetch`/`FormData` lewat hook sendiri).
- **`dompurify`** (v3, tipe bawaan) — sanitasi HTML `content` sebelum `dangerouslySetInnerHTML` di `story-detail.tsx` (helper `src/lib/sanitize-html.ts: sanitizeHtml`). Memakai default DOMPurify (script/iframe/`on*` dibuang, tag format umum dipertahankan). Trust boundary, bukan shortcut.
- Tailwind Typography (`prose`) **tidak wajib**: styling konten editor memakai utility Tailwind langsung + token design system; jika ingin `prose` perlu `@tailwindcss/typography` (catat sebagai TODO opsional, jangan ditambah tanpa kebutuhan).

## 5. Komponen UI via CLI

Tambah komponen shadcn yang belum tersedia via CLI (jangan edit manual `src/components/ui/`):

```
pnpm dlx shadcn@latest add select badge dialog alert-dialog popover command form toggle separator
```

- Sudah tersedia: `button`, `input`, `label`, `form`, `dropdown-menu`, `table`, `skeleton`, `dialog`, `alert-dialog`, `badge`, `select`, `separator`, `textarea`, `checkbox`, `tooltip`, `sonner`.
- Komponen yang perlu dicek/ditambah: `popover` dan `command` (untuk combobox kategori) — **sudah ditambahkan** (plus `toggle` dan `input-group` dependensi `command`); `select`, `badge`, `dialog`, `alert-dialog`, `form`, `separator` sudah ada (perintah boleh idempoten).
- `toggle` dipakai untuk state toolbar editor (opsional — boleh pakai `Button variant=ghost size=icon` + state aktif tanpa `toggle`).
- `calendar` (bersama `react-day-picker`) ditambahkan via `pnpm dlx shadcn@latest add calendar` (style `radix-nova`) untuk komponen reusable `components/shared/date-time-picker.tsx` (dialog publish).

## 6. Kontrak API (kontrak arsitek `backend/docs/modules/story.md`)

Envelope: sukses `{ data, message }`; list `{ data, message, meta: { page, limit, total } }`; error `{ statusCode, message, errors }`. Unwrap dilakukan sekali di `lib/api-client.ts` (`request`/`requestList`).

### Permissions

| Kode | Guna |
| --- | --- |
| `story:read` | Gate halaman list (menu sidebar pakai `admin:access`) |
| `story:create` | Gate tombol Tambah + editor create |
| `story:update` | Gate editor edit |
| `story:delete` | Gate aksi hapus |
| `category:create` | Gate "tambah kategori baru" |
| `category:delete` | Gate aksi hapus kategori di combobox (`DELETE /categories/:id`) |
| `category:read` | Gate pemuatan opsi kategori |

### Endpoint

| Metode | Endpoint | Body/Param | Keterangan |
| --- | --- | --- | --- |
| GET | `/posts?page=&limit=&search=&sortBy=&sortOrder=&filter[status]=&categoryId=` | `search` OR `name, slug`; `sortBy` ∈ `name,slug,status,visibility,publishedAt,createdAt,updatedAt`; `filter` ∈ `status,publishedAt,createdAt,updatedAt`; `categoryId` = UUID kategori (param top-level) | list; item menyertakan `categories: {id,name,type}[]` + `creator: {id,fullName} \| null` |
| GET | `/posts/:id` | — | detail termasuk `content`, `categories`, `creator`, `gallery`, `flyer` (`{ type, images[] }[]`) (dipakai editor edit) |
| POST | `/posts` | `{ name, slug?, content?, thumbnail?, status?, visibility?, categoryIds?, imageIds?, galleryImageIds?, flyerItems? }` | 201; 409 slug duplikat; 422 validasi. `imageIds` = id `Image` yang dipakai (inline + thumbnail); `galleryImageIds` = id galeri **berurut** bila ada; `flyerItems` = `[{ type, imageIds[] }]` **berurut** bila ada; `visibility` ∈ `PUBLIC\|PRIVATE` (default `PUBLIC`) |
| PATCH | `/posts/:id` | partial (field sama, semua opsional) | `categoryIds` bila dikirim = **replace seluruh kategori**; `imageIds` bila dikirim = id gambar **baru**; `galleryImageIds` bila dikirim = **replace seluruh galeri** (urut, `[]` mengosongkan); `flyerItems` bila dikirim = **replace seluruh grup flyer** (urut, `[]` mengosongkan); 409 slug; 422 |
| DELETE | `/posts/:id` | — | 200 |
| GET | `/posts/:id` | — | detail termasuk `content`, `categories`, `creator`, `gallery: ImageResponse[]` **berurut** & `flyer: { type, images: ImageResponse[] }[]` **berurut** (bentuk gambar sama `POST /images`) |
| GET | `/categories?filter[type]=STORY&limit=100` | `sortBy` ∈ `name,type,createdAt,updatedAt` | opsi kategori editor |
| POST | `/categories` | `{ name, type: 'STORY' }` | **idempotent** — nama+type sama mengembalikan existing (bukan 409); dipakai "tambah kategori langsung" |
| DELETE | `/categories/:id` | — | 200; hapus kategori (permission `category:delete`); komponen combobox menampilkan aksi hapus per opsi + dialog konfirmasi |
| POST | `/images` | multipart field `file` (`image/png\|jpeg\|webp`, max 5 MB) | 201 `{ data: { id, url, key, filename, mimeType, size, width, height, variants: [{ name, url, key, width, height, size, mimeType }] }, message }`; semua `url` **absolut** ke S3/CDN. `url` = varian **`large`** (default delivery); `key` = original. Nama varian: `large`, `medium`, `thumbnail` (`thumbnail` variant memakai `name: 'thumbnail'`). **Original tidak muncul sebagai varian** (`variants` hanya hasil resize/kompresi WebP; original tetap `key`/`url` fallback). **GIF dihapus dari mime yang diizinkan**. Max 5 MB / mime tak didukung / **file tidak bisa diproses (corrupt)** → 422 (tampil di komponen editor/thumbnail/galeri, bukan toast); gagal S3 → 500/502 (toast error, **bukan** per-field) |

Catatan: endpoint list/sort/filter mengikuti `RULES.md` Bab 19/19a/19b (whitelist kolom, filter generik `filter[field]`).

Catatan gambar: **tidak ada** endpoint serving gambar di API (tidak ada `GET /images/:key`) dan **tidak ada** konfigurasi Vite proxy untuk gambar — semua `url` dari `POST /images` (termasuk tiap varian) sudah absolut ke S3/CDN sehingga di-render langsung sebagai `<img src>`. Metadata gambar + daftar varian disimpan backend di tabel `images`; FE menyimpan `{ id, url }` (plus `variants` bila butuh preview responsif) yang dikembalikan upload.

## 7. Halaman List (`/stories`)

Container `src/app/routes/stories.tsx`. Mengikuti pola List CRUD `AGENTS.md`.

Halaman punya **2 mode layout** dengan toggle (default **card**):

- **Toggle mode**: state `viewMode: 'card' | 'list'` di page; kontrol grup `Toggle` (`components/ui/toggle.tsx`, `aria-pressed`) di samping `SearchBar` dengan ikon lucide `LayoutGrid`/`List` dan `aria-label` dari i18n (`story:view.card`, `story:view.list`).
- **Card mode** (`story-card.tsx`, presentational, `interface StoryCardProps`): grid kartu `CARD_GRID_CLASS` (konstanta dari `@/components/shared/card-grid`, `grid gap-4 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]` — jumlah kolom mengikuti lebar layar via `auto-fill`, bukan breakpoint tetap; `auto-fill` dipilih agar lebar kartu konsisten saat item sedikit). Tiap kartu (`ui/card.tsx`) menampilkan thumbnail (`aspect-video object-cover`; null → placeholder `bg-muted` + ikon `ImageOff` + `story:card.noThumbnail`), judul (`line-clamp-2`), badge kategori, author (`creator?.fullName` ?? `—`), dan tanggal publish (`formatDateTime`). Badge status & badge `memberOnly` (bila `visibility=PRIVATE`) dirender sebagai overlay `absolute left-2 top-2 z-10` di atas thumbnail (bukan di `CardContent`). Aksi berupa dua `Button` eksplisit di bawah `CardContent` (`<div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">`): **Edit** (`variant="outline"`, `Pencil`, gate `canUpdate`) + **Hapus** (`variant="destructive"`, `Trash2`, gate `canDelete`), dirender bila `showActions = canUpdate || canDelete`; empty state sama dengan tabel (search → `notFound` + Reset, else `empty`).
- **List mode** (`story-table.tsx`, presentational, props `interface`):
  - Kolom: `thumbnail` (img `size-10 rounded object-cover`; null → `—`), `name` (Judul), `categories` (badge list), author (`creator?.fullName` ?? `—`), `status` (badge), `visibility` (badge `Publik`/`Khusus Member`), `publishedAt`, `Aksi`. Kolom `slug`/`createdAt`/`updatedAt` **dihapus** dari tabel agar data sama dengan card.
  - `SortableHeader` hanya pada kolom yang masuk whitelist `sortBy` backend: `name`, `status`, `visibility`, `publishedAt`. Kolom `thumbnail`/`categories`/author **tidak** di-whitelist `sortBy` backend → header non-sortable (**pengecualian terdokumentasi**); kolom `Aksi` tidak sortable.
  - Badge status memetakan `ContentStatus` (`STATUS_VARIANT` dari `./status-variant.ts`, dipakai bersama card): `DRAFT` secondary, `REQUEST` outline, `APPROVED` default, `PUBLISHED` default. Badge visibilitas memakai `VISIBILITY_VARIANT` (`PUBLIC` default, `PRIVATE` secondary).
  - `categories` tampil sebagai list `Badge variant="secondary"`; kosong → `—`.
  - Tanggal via `formatDateTime` dari `@/lib/datetime`.
  - Kolom `Aksi` hilang bila `canUpdate` dan `canDelete` keduanya `false`; aksi pakai `DropdownMenu` (Edit/Hapus) seperti `user-table.tsx`.
- **Skeleton** menyesuaikan mode aktif: card = grid kartu, list = baris (`StoriesCardSkeleton`/`StoriesTableSkeleton`).
- **SearchBar** (`components/shared/search-bar.tsx`): placeholder `Cari judul atau slug...`; debounce 300–500 ms via `useDebouncedValue`; `search` dikirim hanya bila `trim >= 2` char (`appendListParams`); ubah `search` → `setPage(1)`.
- **Filter**: dua `Select` (shadcn) di baris kontrol setelah `SearchBar`, sebelum toggle view — **Status** (`filter[status]`, opsi dari `CONTENT_STATUSES`, label `story:statusOptions.*`) + **Kategori** (param top-level `categoryId`, opsi dari `useCategories(can('category:read'))` → `.data?.items` `StoryCategory[]`, label `category.name`). Sentinel `const ALL = 'ALL'` = "semua"; ubah filter → `setPage(1)`. State `statusFilter`/`categoryFilter` di page; `filter = useMemo(() => status ? { status } : {}, [status])`; `categoryId: categoryFilter || undefined`. Query key `useStories` menyertakan keduanya.
- **Sort**: klik header cycle `asc → desc → null` via `nextSort`; `sort` berubah → `setPage(1)`.
- **Pagination** (`DataTablePagination`): `Total N story · halaman P`.
- **Empty state**: bedakan **"Belum ada story"** vs hasil search nihil (`Tidak ditemukan untuk "<term>"`) + tombol **Reset** (`onResetSearch`).
- **Tombol "Tambah Story"** → `navigate('/stories/new')`, di-gate `can('story:create')`.
- **Aksi baris**: Edit → `navigate('/stories/:id/edit')`; Hapus → `AlertDialog` konfirmasi, di-gate `can('story:delete')`.
- **Query**: `useStories({ page, limit, search, sortBy, sortOrder })` → query key `['story', { page, limit, search, sortBy, sortOrder }]`, `placeholderData: keepPreviousData`.
- **Error**: 403 (`isForbiddenError`) → empty-state "Tidak punya akses"; non-403 → banner `story:errors.loadData`.
- **Toast**: via `@/lib/toast` + i18n `story:toast.*`; hapus sukses → `toastSuccess(t('story:toast.deleted'))`; gagal non-422 → `toastError(getApiErrorMessage(err, t('story:toast.deleteFailed')))`; 422 tidak di-toast.

Contoh query: `/posts?page=1&limit=10&search=ramayana&sortBy=publishedAt&sortOrder=desc&filter[status]=PUBLISHED&categoryId=<uuid>`.

## 8. Halaman Editor (`/stories/new` & `/stories/:id/edit`)

Satu komponen editor dipakai ulang; `story-new.tsx` (create) dan `story-edit.tsx` (edit) menjadi container yang memuat data + menyerahkan `initialValues` ke form. Edit memakai `useStory(id)` untuk memuat detail (`GET /posts/:id`, termasuk `content`).

Layout grid **70/30 tanpa gap** (`grid gap-0 lg:flex-1 lg:min-h-0` + `lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]` saat settings tampil): kolom kiri = editor konten (70%), kolom kanan = panel pengaturan (30%). **Toggle kartu settings**: kartu kanan bisa disembunyikan/ditampilkan lewat state lokal `showSettings` di `story-form.tsx`. Tombol `PanelRightClose` (ghost, `aria-label`/`title` dari `story:form.hideSettings`) di header kartu untuk menyembunyikan; saat tersembunyi `<aside>` **tidak dirender** dan grid otomatis jadi **1 kolom penuh** (kelas `lg:grid-cols-[...]` diterapkan kondisional via `cn()`); tombol `PanelRightOpen` (outline, `absolute right-2 top-2 z-10`, grid `relative`, `aria-label`/`title` dari `story:form.showSettings`) untuk menampilkan kembali. Kartu tanpa `rounded`/`shadow` — pemisah **hanya border**: kelas border editor (`border-b-0 lg:border-b lg:border-r-0`) kini diterapkan **kondisional di parent** (`<RichTextEditor className={cn(showSettings && '...')}>`), sedangkan root `<RichTextEditor>` hanya `flex flex-col overflow-clip border bg-card lg:h-full lg:min-h-0` + `className`. Saat settings tampil: garis vertikal dari border-kiri settings, tanpa border dobel di persimpangan; saat disembunyikan: editor memakai border penuh (kanan/bawah) karena kelas pemisah tidak diterapkan. Tidak ada jarak antar kartu. **Full-height desktop (breakpoint `lg`)**: rantai `lg:h-svh lg:overflow-hidden` di `AppShell` (`div` root editor) → `lg:min-h-0 lg:overflow-hidden` pada `<main>` → `lg:min-h-0` pada wrapper route (`story-new.tsx`/`story-edit.tsx`) → `lg:min-h-0` pada `<form>`/grid → kartu editor & settings `lg:h-full lg:min-h-0`. Hasilnya halaman **tanpa scroll**; masing-masing kartu punya scroll internal (`EditorContent` `lg:flex-1 lg:min-h-0 lg:overflow-y-auto` untuk kanvas, `div` pembungkus `StoryMetaPanel` `lg:min-h-0 lg:flex-1 lg:overflow-y-auto` untuk field settings). Mobile tetap seperti sebelumnya (halaman scroll normal, kartu tinggi natural). Header branch editor `shrink-0`; toolbar editor & baris tombol Simpan/Batal juga `shrink-0` agar tidak ikut mengecil. **Judul halaman hanya di breadcrumb `AppShell`** (Dashboard / Story / `form.createTitle`/`form.editTitle`); halaman editor **tidak** merender `<h1>`+subtitle agar tidak duplikat (empty-state error/forbidden tetap).

### Kiri (70%) — Rich Text Editor

`rich-text-editor.tsx` (TipTap):

- Ekstensi: `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-text-align` (`TextAlign.configure({ types: ['heading', 'paragraph'] })`).
- Placeholder: `Tulis cerita di sini...`.
- **Toolbar** ala template "simple" Tiptap: `Toggle size="sm"` ber-`aria-label` (tanpa teks), digrup dengan `Separator orientation="vertical"` (`mx-1 h-5`) — urutan grup: `[undo, redo] | [bold, italic, strike] | [H2, H3] | [align left, center, right] | [bullet, ordered] | [blockquote, codeBlock] | [inlineCode, horizontalRule, hardBreak] | [clearFormat] | [link, image]`. Tool: undo/redo, bold/italic/strike, H2/H3, **align left/center/right** (`AlignLeft`/`AlignCenter`/`AlignRight`, `setTextAlign('left'\|'center'\|'right')`, aktif via `isActive({ textAlign })`, `aria-label` `story:editor.alignLeft/alignCenter/alignRight`), bullet/ordered, blockquote, **codeBlock** (`SquareCode`), **inlineCode** (`Code`, `toggleCode`, aktif via `isActive('code')`), **horizontalRule** (`Minus`, `setHorizontalRule`, non-toggle), **hardBreak** (`CornerDownLeft`, `setHardBreak`, non-toggle), **clearFormat** (`RemoveFormatting`, `unsetAllMarks().clearNodes()`, non-toggle), link, image. Bar: `flex w-full flex-wrap items-center justify-center gap-0.5 border-b bg-muted/30 px-2 py-1.5` — grup tombol **rata tengah** (`justify-center`); toolbar statis di atas kartu konten (di atas area `EditorContent` yang scroll internal), selalu terlihat tanpa offset/float. State aktif ditandai. Semua tool baru tanpa dependency tambahan (command dari StarterKit/core TipTap).
- **Kanvas**: kartu `overflow-clip border bg-card lg:h-full lg:min-h-0` (tanpa `rounded`/`shadow`; `overflow-clip` menjaga toolbar `sticky` di dalam kartu); kelas pemisah `border-b-0 lg:border-b lg:border-r-0` kini diberikan **kondisional oleh parent** (`story-form.tsx`) hanya saat panel settings tampil. `EditorContent` memakai `[&_.ProseMirror]:mx-auto [&_.ProseMirror]:max-w-4xl [&_.ProseMirror]:min-h-[60vh] [&_.ProseMirror]:px-6 [&_.ProseMirror]:py-8 [&_.ProseMirror]:text-base [&_.ProseMirror]:leading-7 [&_.ProseMirror]:outline-none` (dokumen terpusat, padding lega). Spacing vertikal: `[&_.ProseMirror_h2]:mt-8/mb-3/text-2xl`, `[&_.ProseMirror_h3]:mt-6/mb-2/text-xl`, `[&_.ProseMirror_p]:my-3`; styling placeholder/img rounded/blockquote/pre/ul/ol dipertahankan. Semua lewat token design system, tanpa hardcode warna.
- **Sisip gambar**: tombol memicu pemilihan file → `useUploadImage` (`POST /images`) → saat proses tampil indikator (`story:editor.uploading` / `story:editor.imageProcessing`) → `url` (varian **`large`**) disisipkan ke dokumen pada posisi cursor (`editor.chain().focus().setImage({ src: url }).run()`), dan objek `UploadedImage` dilaporkan ke parent via callback `onImageUploaded(image: UploadedImage)` (atau dikumpulkan di state editor lalu diekspos) agar `image.id` bisa masuk `imageIds`. **Peningkatan (TODO, bukan iterasi ini)**: hasilkan `<img srcset>` dari `variants` (`large` sebagai 1x, `medium` sebagai 2x) agar delivery responsif.
- **Drag & drop gambar**: menjatuhkan file gambar ke kartu editor mengunggah lewat alur yang sama (`onUploadImage` → `POST /images`) lalu menyisipkan hasilnya pada **posisi drop** (`editor.view.posAtCoords({ left: clientX, top: clientY })?.pos` → `insertContentAt`, fallback cursor `setImage`). Tipe/ukuran yang diterima **sama** dengan tombol toolbar (`ACCEPTED_TYPES` PNG/JPEG/WebP + `MAX_SIZE_BYTES` 5 MB; **GIF dihapus**); file lain diabaikan. Multi-file diupload **sekuensial** (`for...of` + `await`) dan posisi insert dimajukan tiap gambar agar urutan sesuai drop. Saat file di atas kanvas tampil overlay `absolute inset-0 z-10 ... border-2 border-dashed border-primary bg-background/80` (token design system) berisi `story:editor.dropHere`; `dragenter/dragleave` dijaga counter ref agar tidak flicker saat melewati child node, dan handler/overlay nonaktif saat `disabled`. Tanpa dependency baru (HTML5 DnD native); tombol toolbar & hidden file input tetap memakai fungsi upload bersama (`uploadAndInsert`).
- **Output**: HTML string diambil via `editor.getHTML()` dan disimpan ke field `content` (dikirim apa adanya ke API); `url` di dalam HTML sudah absolut.
- Styling memakai token design system (`border`, `bg-background`, `text-foreground`, `text-muted-foreground`) + utility Tailwind. **Dilarang hardcode warna.**
- Komponen **presentational**: nilai masuk lewat props (`value`, `onChange`, `onUploadImage`, `onImageUploaded`), tanpa fetch langsung.
- Tidak ada perubahan pada pilihan library TipTap (ekstensi tetap sama).

### Kanan (30%, panel sticky) — Metadata

Dibungkus `<aside className="lg:flex lg:min-h-0">` (di desktop mengisi tinggi kolom grid; sticky lama `lg:sticky lg:top-20 lg:self-start` dihapus karena halaman sudah full-height tanpa scroll) berisi kartu `flex w-full flex-col border bg-card lg:h-full lg:min-h-0 lg:flex-1` (tanpa `rounded`, tanpa padding di root — padding pindah ke body). Header (baris pertama, **sejajar dengan toolbar kartu konten**) `flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5`: kiri heading `<h2 className="text-sm font-semibold">` dari `story:form.settingsTitle` ("Pengaturan"/"Settings"); kanan `div flex items-center gap-2` berisi **tombol Simpan** (`saveButton`) + tombol `Button variant="ghost" size="icon" className="size-8"` ikon `PanelRightClose` (`story:form.hideSettings`) untuk menyembunyikan kartu (`setShowSettings(false)`). Body `<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">` membungkus `<StoryMetaPanel/>` agar field settings scroll di dalam kartu. Saat `showSettings` false, `<aside>` tidak dirender sama sekali; tombol `PanelRightOpen` (outline, `absolute right-2 top-2 z-10`) di grid menampilkannya kembali.

`story-meta-panel.tsx`:

- **Urutan field settings**: **Judul → Slug → Visibilitas → Kategori → Thumbnail → Galeri → Flyer (bertipe)** (blok `categoryIds` dirender tepat setelah `slug`, sebelum `thumbnail`; galeri & flyer dirender `story-meta-panel.tsx` setelah field kategori/thumbnail).
- **Visibilitas**: `RadioGroup` shadcn (`RadioGroupItem`, bukan `Select`/input native) — opsi `PUBLIC`/`PRIVATE` dari `VISIBILITIES`, label `story:visibilityOptions.*`, default `PUBLIC`; field `visibility`, ikut payload create/update. Tiap opsi dibungkus `FormItem`+`FormControl`+`FormLabel` (label aksesibel, navigasi keyboard via RadioGroup, `disabled` diteruskan).
- **Judul** (input teks) → field `name`, `placeholder={t('story:form.titlePlaceholder')}` ("Masukkan judul story..."/"Enter story title..."). Saat create, auto-generate slug dari judul.
- **Slug** (input teks) + tombol **"Generate ulang"**, `placeholder={t('story:form.slugPlaceholder')}` ("judul-story"/"story-title"); auto-generate berhenti setelah slug disentuh manual. Normalisasi mengikuti aturan backend (lowercase, non-alnum → `-`). Error **409 slug duplikat** ditampilkan per-field.
- **Thumbnail** (`thumbnail-upload.tsx`): upload gambar (`POST /images`) + preview `<img src={url}>` + tombol hapus → state menyimpan `{ id, url }`; preview memakai varian **`thumbnail`** (fallback `url` large bila varian tidak ada). Field `thumbnail` dikirim sebagai **`url` (string, absolut)** sedangkan `id` dimasukkan ke `imageIds`. Area upload menerima **drag-and-drop** selain klik (hook bersama `lib/use-file-drop.ts`: `onDragEnter/Over/Leave/Drop`, highlight `ring-2 ring-primary`, counter depth anti-flicker, `preventDefault` walau disabled); mime tanpa GIF. Helper text `story:thumbnail.formats` ("Format: PNG, JPG, atau WebP. Maks 5 MB.") selalu tampil.
- **Galeri** (`gallery-upload.tsx`, presentational, props `value: UploadedImage[]`, `onChange(next)`, `onUpload(file)`, `isUploading`, `error`, `disabled`): **upload multiple** (`<input type="file" multiple>` → `onUpload(image)` per file valid; parent `StoryForm` yang memanggil `onUploadImage` lalu append ke state). Daftar item tampil sebagai **grid card** (`grid grid-cols-2 gap-2 sm:grid-cols-3`); tiap card `<li>` berupa kartu `overflow-hidden rounded-md border bg-card` dengan gambar preview (varian **`thumbnail`** fallback `url`) berukuran `aspect-square w-full object-cover`, **nomor urut** badge `absolute` pojok kiri-atas, **drag handle** (`GripVertical`, `absolute` pojok kanan-atas, `cursor-grab`), serta baris aksi kompak di bawah gambar: hapus (`Trash2`) dan keyboard naik/turun (`ArrowUp`/`ArrowDown`, `aria-label` `story:gallery.moveUp/moveDown`, `size-7`, disabled di ujung). Gambar dibungkus `<button type="button">` (`aria-label`/`title` `story:gallery.preview`) yang membuka **preview** `Dialog` (`@/components/ui/dialog`, state `previewIndex: number | null`, `open={previewIndex !== null}`) berisi gambar aktif `value[previewIndex]` varian **`large`** fallback `url` (`max-h-[70vh] w-auto object-contain`, `DialogContent` `max-w-3xl`). Navigasi **slideshow** lewat tombol **Sebelumnya**/**Berikutnya** (`ChevronLeft`/`ChevronRight`, `Button variant="ghost" size="icon"`, `aria-label` `story:gallery.previous`/`next`) bersifat **wrap-around** (selalu aktif; index `(i + delta + len) % len`) dan keyboard `ArrowLeft`/`ArrowRight` pada `DialogContent` (`onKeyDown`); counter `story:gallery.counter` (`{{current}} / {{total}}`) tampil di `DialogDescription` bersama filename + nomor urut aktif, `DialogTitle` = `story:gallery.previewTitle`; klik gambar card membuka slide ke `setPreviewIndex(index)` — klik tombol aksi tidak memicu preview (DnD tetap di `<li>`, preview hanya dari button gambar). **Reorder via HTML5 Drag and Drop native** (`draggable` + `onDragStart/onDragOver/onDrop`, highlight `ring-2 ring-primary` saat target) — **tanpa dependency dnd-kit**; item yang sedang di-drag `opacity-50`. Area juga **dropzone** (mime/ukuran sama, multi-file). Mime `ACCEPTED_TYPES = ['image/png','image/jpeg','image/webp']` (tanpa GIF), max 5 MB; file invalid → pesan `story:gallery.uploadInvalid` di komponen, non-422 → `onUploadError` parent. Judul section dari `story:gallery.title`, helper `story:gallery.formats`, empty `story:gallery.empty`, tombol `story:gallery.add`/`story:gallery.uploading`. Ditempatkan di `story-meta-panel.tsx` **setelah Thumbnail** (sebelum Kategori).
- **Flyer** (`flyer-media-panel.tsx`, presentational, props interface): blok **media berulang bertipe**. Baris chip `Button` (preset = **id stabil** `flyer`/`poster`/`banner`/`brosur` dari `../lib/flyer-type.ts`, label diterjemahkan **saat render** via `labelForType` → `story:flyer.presets.*`; tipe custom = teks mentah, di-dedupe case-insensitive terhadap `groups`); **centang tipe → grup baru + satu `<GalleryUpload i18nPrefix="flyer">`** (upload multiple, reorder native DnD + tombol keyboard, preview `Dialog` + slideshow, dropzone; mime PNG/JPEG/WebP max 5 MB). Input + tombol `story:flyer.addType` menambah tipe custom (trim, non-kosong, ≤40, tidak duplikat → error `story:flyer.duplicateType`); input yang cocok id preset **atau** label preset locale aktif dipetakan ke id preset agar tidak muncul chip duplikat. Uncheck/`X` tipe yang masih punya gambar → `AlertDialog` konfirmasi (`story:flyer.removeTypeConfirm*`); setuju → grup dibuang. Panel **controlled**: `groups`/`onChange`, upload via `onUpload(type, file)`, error API non-422 per tipe via `errors` map + `uploadingType`. Tiap blok grup dibungkus `<div role="group" aria-labelledby>` menunjuk id heading `flyer-group-<type>-<index>` (indeks mencegah id/key duplikat pada data legacy). Dirender `story-meta-panel.tsx` setelah blok Galeri. State & error per grup di `story-form.tsx` (`flyerGroups`/`uploadingFlyerType`/`flyerErrors`) agar tidak bercampur dengan galeri.

> **Catatan `type` grup flyer (id stabil vs label):** `FlyerGroup.type` menyimpan **identifier stabil** preset (`flyer`/`poster`/`banner`/`brosur`), **bukan** label terjemahan — agar data tidak bergantung locale. Label hanya dihitung saat render via `labelForType(type, t)` di `../lib/flyer-type.ts` (dipakai `flyer-media-panel.tsx`, `story-detail.tsx`, dan pembungkus submission di `story-submission-detail.tsx`). `type` custom tetap teks apa adanya; kontrak backend tidak berubah (teks bebas, trim, ≤40).
- **Status**: **tidak** dipilih lewat field Select di panel (field `status` dihapus dari `StoryMetaPanel`). Status dikontrol lewat aksi tombol (lihat §8): **Simpan** (status tetap), **Simpan sebagai Draft** (bila `status === 'PUBLISHED' || (canPublishStory && status === 'APPROVED')`), **Terbitkan** (bila `canPublishStory` dan `status !== 'REQUEST'`), dan saat `status === 'REQUEST'` muncul baris penuh **Setujui** / **Tolak**. Story **punya** aksi **Ajukan untuk Terbit** untuk pengaju non-publisher (`!canPublishStory && canSubmitStory && status === 'DRAFT'`) → `POST /posts/:id/submit` (`story:submit`, lihat §8a). **Semua aksi status (draft/request/save changes/approve/reject) kini lewat dialog konfirmasi `AlertDialog`** — item/tombol memanggil `void requestStatusChange(action, t('<label>'))` (`label` i18n sesuai aksi, mis. `story:workflow.approve`); helper `requestStatusChange` menjalankan `await form.trigger()` **lebih dulu** dan hanya membuka dialog bila valid (`if (!valid) return`) — **form invalid → error per-field tampil, dialog TIDAK terbuka**. Dialog menampilkan `story:confirm.title` + `story:confirm.description` (interpolasi `{{action}}` = label), dan `AlertDialogAction` (`story:confirm.submit`) yang memanggil `runSubmit(action)` setelah dialog ditutup. Draft/request/save memakai `PATCH /posts/:id { status }` (kontrak backend: `ContentStatus = DRAFT | REQUEST | APPROVED | PUBLISHED`, **tidak ada** state `REJECTED`). Approve/reject kini lewat endpoint khusus setelah PATCH dulu: `POST /posts/:id/approve { publishedAt }` (`story:approve`) dan `POST /posts/:id/reject` (`story:reject`) — **bukan** `PATCH status`; `APPROVED` deprecated. Status hanya ikut pada payload bila validasi lulus (`runSubmit(action)` memanggil `form.handleSubmit((values) => handleSubmit(values, action, publishedAt))` — **tidak** menulis state form lewat `setValue`).
- **Kategori** (`category-combobox.tsx`): multi-select/combobox shadcn (`Popover` + `Command`) memuat opsi via `GET /categories?filter[type]=STORY&limit=100`; ada input untuk **menambah kategori baru langsung** → `POST /categories { name, type: 'STORY' }` (idempotent) lalu pilih otomatis. Hasil disimpan sebagai `categoryIds`.
  - **Hapus kategori dari combobox** (gate `category:delete`, UX sama dengan hapus author): tiap `CommandItem` menampilkan tombol `Trash2` (`ml-auto`, `variant="ghost" size="icon"`, `onPointerDown`/`onClick` `stopPropagation`, `aria-label`/`title` `story:deleteCategory.optionLabel`) bila `canDeleteOption` true — predikat `canDeleteCategory && !categoryIds.includes(id)` (opsi terpilih tidak bisa dihapus dari sini). Klik → `CategoryDeleteDialog` (`AlertDialog` destruktif, `story:deleteCategory.title/description`) → `useDeleteCategory` (`DELETE /categories/:id`, invalidate `['categories']`) → sukses buang id dari `categoryIds` + `story:toast.categoryDeleted`; gagal non-422 `story:toast.categoryDeleteFailed` (422 early-return).
- **Terbitkan (`publishedAt`)**: tombol **Terbitkan** (`Button size="sm"`, ikon `CalendarClock` leading, label `story:form.publish`) muncul di header kartu settings **dan** di grup tombol saat settings disembunyikan (`showSettings=false`), bila `canPublishStory` **dan** `status !== 'REQUEST'`. Klik → `await form.trigger()` lebih dulu; invalid → error per-field, dialog **tidak** terbuka. Valid → buka `components/shared/publish-schedule-dialog.tsx` (`open={publishOpen}`): **langkah 1** `Dialog` berisi label `story:publishDialog.dateLabel` + `components/shared/date-time-picker.tsx` (`Popover` + `Calendar`, jam/menit via `Select` shadcn; **bukan** `<input type="datetime-local">` native), nilai awal ISO `initialPublishedAt ?? now`, tombol "Lanjut" (`story:confirm.submit`) nonaktif bila kosong/`isPending`; **langkah 2** `AlertDialog` konfirmasi (`story:confirm.title` + `story:publishDialog.confirmDescription`, tombol `story:publishDialog.confirm`). Konfirmasi → `onConfirm(publishedAt)` → `runSubmit(publishAction === 'approve' ? 'approve' : 'publish', publishedAt)`. Tombol **Setujui** di banner `REQUEST` membuka dialog yang sama dengan `publishAction='approve'` → `runSubmit('approve', publishedAt)` (status tetap `REQUEST`; `publishedAt` diteruskan ke `POST /posts/:id/approve`, dibuang dari body PATCH); `publish` → `runSubmit('publish', publishedAt)` (status `PUBLISHED` + `publishedAt` ISO 8601 UTC via PATCH). Kontrak backend: bila `publishedAt` dikirim, backend menetapkan tanggal itu dan memaksa `status = PUBLISHED`; **tidak ada penjadwalan otomatis** — FE mengirim tanggal manual (aksi "Terbitkan" dengan tanggal default = waktu saat konfirmasi). Sumber `publishedAt` existing diteruskan `story-edit.tsx` via prop `initialPublishedAt` (tidak masuk skema form agar `PATCH` biasa tidak ikut memaksa publish).

### Aksi

- Tombol **Batal** & **Simpan** dipisah jadi variabel `cancelButton` / `saveButton` di `story-form.tsx` (keduanya `size="sm"` agar setinggi tombol toolbar editor `Toggle size="sm"` = h-8) sehingga dapat dirender di lokasi berbeda tanpa duplikasi JSX:
  - **Batal**: di **kiri toolbar editor konten** via prop `leading` pada `RichTextEditor` (`Toolbar` `relative`, slot `absolute left-2 top-1/2 -translate-y-1/2`); tombol format tetap rata tengah (`justify-center`) dan tidak tergeser.
  - **Aksi (tanpa dropdown)**: **Simpan** (`runSubmit('save')`, outline, **selalu**; label `story:form.saveAsDraft` saat `status === 'DRAFT'`, selain itu `story:form.save`) + **Simpan sebagai Draft** (`story:form.saveAsDraft` → `void requestStatusChange('draft', …)`, tampil bila `status === 'PUBLISHED'` **atau** (`canPublishStory` **dan** `status === 'APPROVED'`); non-admin yang punya `story:update` di rolenya melihatnya pada PUBLISHED untuk revert ke draft, sedangkan role seeded `member` belum punya `story:update`) + **Terbitkan** (primary, `story:form.publish` → `void openPublishDialog('publish')`, bila `canPublishStory` **dan** `status !== 'REQUEST'`) + **Ajukan untuk Terbit** (`story:form.requestPublish` → `void requestStatusChange('request', …)`, tampil bila `!canPublishStory` **dan** `canSubmitStory` **dan** `status === 'DRAFT'`; lihat §8a). Item "Simpan perubahan" tidak ada. Semua `disabled={isPending}`; aksi draft membuka dialog konfirmasi (`requestStatusChange` set `confirmAction`+`confirmOpen`), Terbitkan membuka dialog tanggal. Ditempatkan di **header kartu settings** (panel kanan 30%) saat `showSettings=true`, sejajar toolbar konten.
  - Saat settings disembunyikan (`showSettings=false`): grup aksi berada di **kanan-atas area konten** bersebelahan dengan tombol **toggle show** (`PanelRightOpen`) dalam `div absolute right-2 top-2 z-10 flex items-center gap-2`. Aksi **selalu tersedia** walau `<aside>` tidak dirender.
  - **Workflow saat `status === 'REQUEST'`**: baris penuh `flex shrink-0 flex-wrap items-center justify-between gap-2 border bg-card px-4 py-2` dirender **di dalam `<form>`, tepat sebelum grid**. Berisi label `story:workflow.requested` + grup tombol `size="sm"` yang di-gate permission: **Tolak** (`story:workflow.reject` → `requestStatusChange('reject', …)` → `POST /posts/:id/reject`) hanya bila `canRejectStory` (`story:reject`); **Setujui** (`story:workflow.approve` → `openPublishDialog('approve')` → `PublishScheduleDialog` → `runSubmit('approve', publishedAt)` → `POST /posts/:id/approve { publishedAt }`) hanya bila `canApproveStory` (`story:approve`); bila tidak ada keduanya hanya teks menunggu **tanpa tombol**. Semua `disabled={isPending}` + dialog konfirmasi.
  - Tetap di dalam `<form onSubmit>`. **Simpan**: create → `POST /posts`; edit → `PATCH /posts/:id`. **Batal** → kembali ke `/stories`.
  - **Action-aware submit**: `StoryFormProps.onSubmit` = `(payload, action: StoryFormAction)`. `story-edit.tsx` menyimpan perubahan field lewat `PATCH /posts/:id` dulu; untuk `action === 'approve'` field `publishedAt` dibuang dari body PATCH (PATCH `publishedAt` memaksa `PUBLISHED` → approve 409), lalu `POST /posts/:id/approve { publishedAt }` (`useApproveStory`); `action === 'reject'` → `POST /posts/:id/reject` (`useRejectStory`). PATCH **tidak lagi** membawa approve/reject. `isPending` gabungan `updateStory` + `approveStory` + `rejectStory`.
- **Binding gambar (`imageIds`)**: `use-create-story`/`use-update-story` mengumpulkan id gambar yang diupload selama sesi edit (dari `onImageUploaded` editor + `{id}` thumbnail) dan mengirimnya sebagai `imageIds`. Saat edit, gambar lama **sudah ter-bind** ke post, jadi cukup kirim id gambar **baru**; backend yang mengikat ke post.
- **Binding galeri (`galleryImageIds`)**: `StoryForm` menyimpan state `galleryImages: UploadedImage[]` (initial dari prop `initialGallery`; `story-edit.tsx` meneruskan `story.gallery`). Payload mengirim `galleryImageIds = galleryImages.map(i => i.id)` **berurut**, terpisah dari `imageIds` (tanpa dobel). Saat edit selalu dikirim (termasuk `[]`) agar urutan/penghapusan galeri diterapkan; saat create hanya bila ada isi.
- **Binding flyer (`flyerItems`)**: `StoryForm` menyimpan state `flyerGroups: FlyerGroup[]` (initial dari prop `initialFlyer`; `story-edit.tsx` meneruskan `story.flyer ?? []`). Payload mengirim `flyerItems = flyerGroups.filter(g => g.images.length > 0).map(g => ({ type: g.type, imageIds: g.images.map(i => i.id) }))` **berurut** (grup kosong dibuang), terpisah dari `imageIds`/`galleryImageIds` (tanpa dobel). Saat edit selalu dikirim (termasuk `[]`) agar urutan/penghapusan grup diterapkan; saat create hanya bila non-kosong (`if (mode === 'edit' || flyerItems.length > 0)`). Kontrak backend: request `flyerItems`, response `flyer: { type, images[] }[]`. Duplikat tipe (case-insensitive) & id gambar duplikat → 422 dari server (di-map per-field via `mapApiFieldErrors`).
- Sukses → toast (`story:toast.created`/`story:toast.updated`) + redirect ke `/stories`.
- 422 → `form.setError` per-field, **tetap di halaman** (tanpa toast, tanpa redirect).
- **Batasan iterasi**: menghapus gambar inline dari content **tidak** otomatis menghapus aset di S3 (tidak ada endpoint delete) → gambar menjadi orphan. Catat sebagai **TODO cleanup backend**; bukan tanggung jawab FE iterasi ini.

### 8a. Alur Submission Anggota (`story:submit`)

- **Menu** tampil untuk siapa pun dengan `story:read` (termasuk `member`) — `permission: 'story:read'` di `app-shell.tsx`.
- **Endpoint**: `POST /posts/:id/submit` (permission `story:submit`) → `submitStory(id)` di `api/posts.ts`; hook `useSubmitStory` (`features/story/hooks/use-submit-story.ts`) invalidate `['story']` + `['story', { id }]` (mirror `use-submit-event`).
- **Tombol "Ajukan untuk Terbit"** (`story:form.requestPublish`, ikon `Send`) di `StoryForm` — muncul bila `!canPublishStory && canSubmitStory && status === 'DRAFT'`; lewat `requestStatusChange('request', …)` → dialog konfirmasi → `runSubmit('request')`.
- **Create** (`story-new.tsx`): bila `payload.status === 'REQUEST'` → buat dulu dengan `status: 'DRAFT'` (backend mengabaikan `status` create bagi non-admin), lalu `submitStory.mutateAsync(created.id)`. Submit gagal → toast `story:toast.createFailed` + `navigate('/stories/${created.id}/edit')` (cegah duplikat). Sukses → toast `story:toast.created` + `/stories`.
- **Edit** (`story-edit.tsx`): `handleSubmit` menyimpan `updated` dari PATCH; pada cabang non approve/reject, bila `action === 'request' && updated.status === 'DRAFT'` → `await submitStory.mutateAsync(id)` lalu toast `story:toast.updated`.
- **`isPending`** gabungan menyertakan `submitStory.isPending`; prop `canSubmitStory` diteruskan `story-new.tsx`/`story-edit.tsx` (`can('story:submit')`).
- Pola identik alur event (`event-new.tsx`/`event-edit.tsx`, `use-submit-event`, `submitEvent`) — hanya FE wiring; endpoint & permission sudah ada di backend. **Tidak ada** key i18n baru (`story:form.requestPublish` + `story:workflow.*` sudah ada di kedua locale).

## 9. Form & Validasi

- **RHF + zod**; schema `useMemo(..., [t])`; pesan hanya dari `t('validation:*')`.
- Mirror DTO backend:
  - `name`: wajib, `trim`, max 200.
  - `slug`: opsional, max 200, pola slug (lowercase alnum + `-`).
  - `content`: opsional (string HTML).
  - `thumbnail`: opsional (URL string).
  - `status`: opsional enum `ContentStatus`.
  - `visibility`: enum `Visibility` (`PUBLIC`/`PRIVATE`, default `PUBLIC`).
  - `categoryIds`: opsional `string[]`.
  - `imageIds`: opsional `string[]` (id `Image` hasil `POST /images`).
- Map 422 via `mapApiFieldErrors` dari `@/lib/field-errors` → `useEffect` + guard `isValidationError(err)` → `form.setError(field, { message })`.
- Setiap field punya `<FormMessage />` **kosong**.
- **Banner error hanya non-422** (409/500/network); 422 tampil per-field.
- **Validasi client dijalankan sebelum dialog konfirmasi**: aksi status (draft/request/save changes/approve/reject) memanggil `requestStatusChange` yang `await form.trigger()` lebih dulu; invalid → error per-field tampil, dialog konfirmasi **tidak** muncul. `runSubmit(action)` tetap memvalidasi ulang lewat `form.handleSubmit` saat dialog dikonfirmasi.
- **Placeholder field**: judul `story:form.titlePlaceholder`, slug `story:form.slugPlaceholder` (input lain/thumbnail/kategori tanpa placeholder).

## 10. Permissions

| Route / Aksi | Kode dibutuhkan |
| --- | --- |
| Route `/stories` (list) | `story:read` (via `RequirePermission`; tanpa akses → `/403`) |
| Route `/stories/new` (editor create) | `story:create` dicek di dalam komponen |
| Route `/stories/:id/edit` (editor edit) | `story:update` dicek di dalam komponen |
| Tombol "Tambah Story" | `story:create` |
| Aksi Edit baris | `story:update` |
| Aksi Hapus baris + `DELETE /posts/:id` | `story:delete` |
| Tombol Terbitkan / `PublishScheduleDialog` → `runSubmit('publish')` (`status` → `PUBLISHED`) | `story:publish` |
| Banner Setujui → simpan PATCH dulu, lalu `POST /posts/:id/approve { publishedAt }` (`useApproveStory`) | `story:approve` |
| Banner Tolak → simpan PATCH dulu, lalu `POST /posts/:id/reject` (`useRejectStory`) | `story:reject` |
| Tombol **Ajukan untuk Terbit** (create/edit) → create draft lalu `POST /posts/:id/submit` (`useSubmitStory`) | `story:submit` |
| Pemilihan kategori (`GET /categories`) | `category:read` |
| Tambah kategori baru (`POST /categories`) | `category:create` |
| Aksi hapus kategori (`DELETE /categories/:id`) | `category:delete` |
| Menu sidebar "Story" | `story:read` (menu tampil bila punya `story:read`, termasuk `member`) |

- Gate tombol via `can(...)` dari `useAuthPermissions()`; gate route list via `RequirePermission`.
- Tanpa izin create/update, editor menampilkan empty-state/redirect internal (mis. ke `/stories`) dengan pesan — tidak memanggil mutation.

## 11. i18n

- Namespace baru **`story`**; file `src/i18n/locales/{en,id}/story.json`.
- Daftarkan di `src/i18n/index.ts` (import resources + tambah ke `resources.en`/`resources.id` + array `ns`).
- Tambah key `dashboard:nav.story` di `{en,id}/dashboard.json`.

Key yang direncanakan:

```
story:title
story:subtitle
story:add
story:search.placeholder / story:search.ariaLabel
story:view.{card,list}
story:filter.{status,allStatuses,category,allCategories}
story:table.{thumbnail,name,categories,author,status,visibility,publishedAt,empty,notFound,reset,edit,delete}
story:card.{noThumbnail}
story:statusOptions.{DRAFT,REQUEST,APPROVED,PUBLISHED}
story:visibilityOptions.{PUBLIC,PRIVATE}   # PRIVATE = "Khusus Member"/"Members Only" (enum API tetap PRIVATE)
story:form.{createTitle,editTitle,titleLabel,titlePlaceholder,slugLabel,slugPlaceholder,slugGenerate,thumbnail,thumbnailUpload,thumbnailRemove,categories,categoryPlaceholder,categoryAdd,categorySearch,categoryEmpty,visibility,save,saveChanges,saveAsDraft,requestPublish,publish,cancel,settingsTitle}
story:publishDialog.{title,description,dateLabel,confirm,confirmDescription}   # dialog aksi Terbitkan (publishedAt ISO 8601 UTC)
story:workflow.{requested,approve,reject}
story:confirm.{title,description,submit}   # dialog konfirmasi aksi status; description interpolasi {{action}}
story:delete.{title,description}
story:deleteCategory.{title,description,optionLabel}   # dialog + label tombol hapus kategori di combobox
story:editor.{placeholder,bold,italic,strike,h2,h3,bulletList,orderedList,blockquote,codeBlock,inlineCode,horizontalRule,hardBreak,clearFormat,link,image,uploadImage,uploading,imageProcessing,uploadFailed,undo,redo,uploadingImage}
story:thumbnail.{upload,uploading,remove,formats,uploadInvalid}
story:gallery.{title,add,empty,formats,uploading,uploadInvalid,remove,moveUp,moveDown}
story:flyer.{title,typeLabel,addType,customTypePlaceholder,duplicateType,removeType,removeTypeConfirmTitle,removeTypeConfirmDescription,removeTypeConfirmConfirm,removeTypeConfirmCancel,presets.{flyer,poster,banner,brosur}}   # blok media bertipe (chip + panel)
story:flyer.{add,empty,formats,uploading,uploadInvalid,remove,moveUp,moveDown,preview,previewTitle,previous,next,counter}   # paralel galeri; `GalleryUpload` via i18nPrefix="flyer"
story:errors.{loadData,forbidden,loadCategories,loadDetail,slugDuplicate,thumbnail,uploadFailed}
story:toast.{created,updated,deleted,createFailed,updateFailed,deleteFailed,categoryDeleted,categoryDeleteFailed}
```

Key validasi ditambahkan ke namespace **`validation`** (`storyNameRequired`, `storyNameMax`, `storySlugMax`, `storySlugPattern`, dst.).

Catatan key upload: `story:editor.uploadImage` (label/tooltip tombol), `story:editor.uploading` (indikator transfer), `story:editor.imageProcessing` (indikator saat backend resize/kompresi varian), `story:editor.uploadFailed` (pesan error **non-422** di komponen editor), `story:thumbnail.uploadFailed` (pesan error **non-422** di komponen thumbnail). Pesan 422 (mime/ukuran/file corrupt) tampil di komponen editor/thumbnail (boleh key `story:editor.uploadInvalid`/`story:thumbnail.uploadInvalid` bila diperlukan) — key final diserahkan implementasi; yang penting tercatat di rencana.

## 12. Toast Feedback

- Sukses/gagal: `story:toast.created/updated/deleted` + `story:toast.createFailed/updateFailed/deleteFailed` (via `t()`, tanpa hardcode).
- Helper `@/lib/toast`: `toastSuccess` di `onSuccess`; `toastError(getApiErrorMessage(err, t('story:toast.*Failed')))` di `onError`.
- 422 → early-return `if (isValidationError(err)) return;` (per-field, tanpa toast, tetap di halaman).
- Upload gambar: sukses tidak perlu toast utama (tidak invalidate list story). Error non-422 (500/502/network) → `toastError(getApiErrorMessage(err, t('story:errors.uploadFailed')))`. Error 422 (max 5 MB / mime tak didukung / file corrupt) → early-return tanpa toast, pesan tampil di komponen editor/thumbnail (`story:editor.uploadFailed`/`story:thumbnail.uploadFailed`).
- `<Toaster/>` sudah mount sekali di `src/app/providers.tsx`.

## 13. Konvensi (AGENTS.md)

- Query key domain `['story', ...]` + `['categories', { type: 'STORY' }]`; `placeholderData: keepPreviousData` untuk list.
- Mutation invalidate key terkait di `onSuccess` (`['story']`, `['story', { id }]`, `['categories']`); toast di call-site page, bukan hook. **Upload (`use-upload-image`) tidak invalidate list story** (gambar belum terikat post sampai simpan).
- `url` gambar dari API selalu absolut (S3/CDN) — jangan prefix base URL/proxy saat render `<img src>`. Metadata `images` dipegang backend; FE simpan `{ id, url }` (opsional `variants` untuk preview/srcset). `url` = varian `large`; original tidak muncul di `variants`.
- Komponen **presentational**: data via props (`interface`), tanpa fetch langsung, tanpa import lintas domain (hanya `components/ui`, `components/shared`, `lib`, `i18n`).
- Tanpa `any` di boundary API, tanpa `@ts-ignore`.
- Tanggal via `formatDateTime`/`formatDate` dari `@/lib/datetime`; kirim filter tanggal ISO UTC (`filter[publishedAt][gte]=<ISO>`).
- Bahasa UI Indonesia.
- Semua string UI via i18n; notasi ini brief — implementasi menyusul setelah endpoint backend siap.

## 14. Status & Catatan

- **Status**: ✅ **Implementasi frontend selesai** — `features/story/` (api/hooks/components/types), 3 route (`/stories`, `/stories/new`, `/stories/:id/edit`), item sidebar Story, namespace i18n `story`, dependency TipTap, dan komponen shadcn (`popover`, `command`, `toggle`, `input-group`) sudah ditambahkan. Verifikasi `pnpm lint` (0 error, warning pre-existing), `pnpm exec tsc -p tsconfig.app.json --noEmit` (bersih), `pnpm build` (sukses). Catatan: `pnpm tsc --noEmit` **no-op** karena `tsconfig.json` `files: []` (hanya `references`) — gunakan perintah `pnpm exec tsc -p tsconfig.app.json --noEmit`. E2E menunggu backend `posts`/`categories`/`images` siap.
- **File tambahan di luar rancangan §3**: `components/story-form.tsx` (form editor dipakai ulang create/edit) dan `lib/schema.ts` (skema zod + `StoryFormValues`). Dipertahankan karena dua halaman container memakai satu form yang sama.
- **Backend TODO**: modul & migration `posts`/`categories` belum diimplementasikan; endpoint `POST /images` disiapkan backend (S3 + pipeline resize). `backend/docs/modules/story.md` (kontrak rujukan) dipakai sebagai fakta desain.
- **Dependency backend (konteks, bukan dep FE)**: backend memakai `@aws-sdk/client-s3` (upload S3 + metadata tabel `images`) dan **`sharp`** (native, resize/kompresi varian); upload disimpan ke S3 + metadata di tabel `images`.
- **Prasyarat UI**: ✅ dependency TipTap dan komponen shadcn sudah ditambahkan.
- **Catatan CLI shadcn**: generator sempat menulis `import { cn } from "cn"` di file UI baru — diubah ke `@/lib/utils` (satu baris, agar lolos typecheck), bukan modifikasi gaya.
- **Pengecualian terdokumentasi**: kolom `thumbnail`/`categories`/author di tabel tidak sortable karena tidak ada di whitelist `sortBy` backend.
- **Iterasi layout list (2 mode)**: halaman `/stories` kini punya mode **Card** (default) & **List** dengan toggle `Toggle` (ikon `LayoutGrid`/`List`); komponen baru `story-card.tsx`; tabel dirampingkan ke 7 kolom (thumbnail/name/categories/author/status/publishedAt/aksi). Key i18n baru: `story:view.card`, `story:view.list`, `story:table.thumbnail`, `story:table.author`, `story:card.noThumbnail`. Query/pagination/mutation tidak berubah.
- **Iterasi layout editor (rebuild)**: halaman create/edit dirombak jadi grid **70/30** (editor 70% + panel pengaturan 30% berkartu & sticky `top-20`), editor direstyle ala template "simple" Tiptap (toolbar bergrup dengan `Separator`, kanvas dokumen terpusat `max-w-2xl` di kartu), dan **sidebar disembunyikan** pada `/stories/new` & `/stories/:id/edit` via branch `isStoryEditor` di `app-shell.tsx`. Key i18n baru: `story:form.settingsTitle` (key `story:form.contentTitle` dihapus — judul "Konten" tak lagi dirender). Logika form/payload/error handling tidak berubah.
- **Iterasi flyer bertipe**: blok Flyer tunggal diganti **media berulang bertipe** — komponen baru `components/flyer-media-panel.tsx` (chip preset `flyer/poster/banner/brosur` dari `story:flyer.presets.*` + tipe custom; tiap tipe tercentang = satu blok `GalleryUpload`; uncheck bertipe berisi gambar → `AlertDialog` konfirmasi). Kontrak berubah: request `flyerImageIds: string[]` → **`flyerItems: { type, imageIds[] }[]`** (urut = urut grup; edit selalu kirim termasuk `[]`, create hanya bila non-kosong), response `flyer: UploadedImage[]` → **`flyer: { type, images[] }[]`**; `types.ts` menambah `FlyerGroup`/`FlyerItemInput`. State `story-form.tsx` `flyerImages` → `flyerGroups` + `uploadingFlyerType` + `flyerErrors` (per tipe). `story-detail.tsx` merender satu `<section>` per grup (heading `group.type`, gate `images.length > 0`); key `story:detail.flyer` **dihapus**. `story-submission-detail.tsx` memetakan `submission.flyer` (kontrak submission tak berubah) → `[{ type: 'flyer', images: submission.flyer }]` (id stabil, label diterjemahkan saat render). **Revisi:** `FlyerGroup.type` kini menyimpan **id stabil preset** (`flyer|poster|banner|brosur`), bukan label terjemahan — label dihitung saat render via `labelForType` (`features/story/lib/flyer-type.ts`) di panel, `story-detail.tsx`, dan pembungkus submission; input tipe custom yang sama dengan id/label preset dipetakan ke id preset.
- **Batasan iterasi**: hapus gambar inline dari content tidak menghapus aset S3 (orphan) — perlu cleanup backend (TODO, di luar FE).
- **Iterasi galeri + dropzone**: `gallery-upload.tsx` baru (galeri multiple, urut, reorder native DnD + tombol keyboard, dropzone); `thumbnail-upload.tsx` dapat dropzone + helper format; mime PNG/JPEG/WebP (GIF dihapus) di editor/thumbnail/galeri; hook bersama `lib/use-file-drop.ts`; `Story.gallery` + `CreateStoryInput.galleryImageIds`; `StoryForm` kirim `galleryImageIds` berurut (terpisah dari `imageIds`). Key i18n baru: `story:gallery.*`, `story:thumbnail.formats`; teks `uploadInvalid` editor/thumbnail tanpa GIF. Tanpa dependency dnd-kit.
- **Iterasi visibilitas**: field `visibility` (`PUBLIC`/`PRIVATE`, default `PUBLIC`) ditambahkan ke `Story`/`CreateStoryInput`, zod schema (`VISIBILITIES`), meta-panel (Select shadcn), tabel (kolom badge `VISIBILITY_VARIANT` + `SortableHeader` field `visibility`), i18n `en`/`id`. Sort server-side `sortBy=visibility`; wiring generik page/api/hook meneruskan tanpa perubahan. Lint 0 error (7 warning pre-existing), tsc bersih.
- **Iterasi drag & drop gambar editor**: `rich-text-editor.tsx` kini punya satu fungsi upload bersama (`uploadAndInsert(file, at?)`) yang dipakai tombol toolbar, hidden file input, dan drop; drop menyisipkan pada posisi koordinat drop, multi-file sekuensial menjaga urutan, overlay `story:editor.dropHere` + counter `dragenter/dragleave` mencegah flicker. Tanpa dependency baru. Key i18n baru: `story:editor.dropHere`.
- **Iterasi alur status Story**: tombol Simpan jadi dropdown (Draft / Ajukan Terbit); saat `status === 'REQUEST'` tampil baris aksi Setujui & Tolak. Field Select Status dihapus dari `StoryMetaPanel`. Keterbatasan backend yang diikuti FE: (1) tidak ada state `REJECTED` — Tolak mengembalikan ke `DRAFT`; (2) saat iterasi ini belum ada endpoint `story:approve`/`story:reject` — kini approve/reject punya endpoint khusus `POST /posts/:id/approve { publishedAt }` / `POST /posts/:id/reject` (lihat «Iterasi endpoint transisi editor»); (3) `APPROVED` **tidak** otomatis mengisi `publishedAt`; (4) aksi **Terbitkan** tampil bila `canPublishStory && status !== 'REQUEST'` lewat dialog `publishedAt` (mengisi `publishedAt` + memaksa `PUBLISHED` di backend) — **tidak ada penjadwalan otomatis**, tanggal selalu dikirim manual.
- **Iterasi grid card responsif**: string grid tetap `gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` diganti `CARD_GRID_CLASS` dari `components/shared/card-grid.ts` (`grid gap-4 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]`) — jumlah kolom mengikuti lebar layar native (CSS Grid `auto-fill`), dipakai juga oleh `event-card.tsx` + skeleton `StoriesCardSkeleton`/`EventsCardSkeleton`, menghindari drift 4 lokasi. Tanpa JS, tanpa dependency baru. `auto-fill` (bukan `auto-fit`) menjaga lebar kartu saat item sedikit.
- **Iterasi badge card**: badge status dipindah dari `CardContent` ke **overlay pojok kiri-atas thumbnail** (`absolute left-2 top-2 z-10`, `shadow-sm`) di `story-card.tsx`; badge `memberOnly` (`variant="secondary"`, `shadow-sm`) muncul bila `visibility === 'PRIVATE'`. Key i18n baru `story:card.memberOnly` (`Khusus Member`/`Members Only`). Penulis kini `span` tunggal (`truncate text-muted-foreground`). `VISIBILITY_VARIANT` tidak diimpor di card (hanya `STATUS_VARIANT`). Tanpa perubahan query/payload.
- **Iterasi security + aksesibilitas detail (review)**: (1) **stored XSS** — `story-detail.tsx` tidak lagi merender `content` mentah; disanitasi `sanitizeHtml()` (DOMPurify, `useMemo` keyed `content`) di `lib/sanitize-html.ts`, default config (script/iframe/`on*` dibuang). Dependency `dompurify@3`. (2) **detail tak terjangkau** — `story-card.tsx` (thumbnail + judul) dan `story-table.tsx` (judul) dibungkus `Link` ke `/stories/:id` (tanpa prop baru, tanpa mengubah handler Edit/Hapus; card/row tidak sendiri clickable sehingga tak perlu `stopPropagation`). Key i18n baru `story:detail.open` + `{{name}}`. (3) **request sia-sia** — `useStory(id, enabled = true)` (opsional, caller lama tak berubah); `story-detail.tsx` memanggil `useStory(id, canRead)` sehingga query tidak jalan saat `story:read` absen.
- **Iterasi gate aksi workflow (permission, tanpa nama role)**: tombol aksi `StoryForm` kini **2 `Button`** — **Simpan sebagai Draft** (selalu) + **Terbitkan** (hanya `canPublishStory` = `story:publish`); dropdown "Simpan perubahan"/"Ajukan untuk Terbit" dihapus. Banner `status === 'REQUEST'`: **Setujui** hanya `canApproveStory` (`story:approve`), **Tolak** hanya `canRejectStory` (`story:reject`); tanpa keduanya hanya teks menunggu. Props boolean `canPublishStory/canSubmitStory/canApproveStory/canRejectStory` dikirim `story-new.tsx`/`story-edit.tsx` (komponen tetap presentational). Key `story:form.requestPublish` dipakai tombol **Ajukan untuk Terbit** (anggota dengan `story:submit`). Menu Story tampil via `story:read`; `member` kini punya `story:create/update/submit` → dapat membuat/mengubah story sendiri dan mengajukan ke `REQUEST`, sedangkan admin menangani approve/reject/publish (`story:approve/reject/publish`).
- **Iterasi upload flyer (paralel galeri)**: `gallery-upload.tsx` kini dapat dirender sebagai **Flyer** lewat prop `i18nPrefix?: 'gallery' | 'flyer'` (default `gallery`; hanya mengganti prefix key i18n — perilaku sama). `story-meta-panel.tsx` menambahkan blok `<GalleryUpload i18nPrefix="flyer">` setelah Galeri; `story-form.tsx` memegang state `flyerImages`/`isUploadingFlyer`/`flyerError` + `handleFlyerUpload` dan mengirim `flyerImageIds` (edit selalu, termasuk `[]`; create hanya bila non-kosong). `Story.flyer: UploadedImage[]` + `CreateStoryInput.flyerImageIds?: string[]`; `story-edit.tsx` meneruskan `initialFlyer={story.flyer ?? []}`. Key i18n baru `story:flyer.*` (id/en).
- **Iterasi render flyer di halaman detail**: `story-detail.tsx` menambahkan section flyer read-only **setelah** Galeri — reuse `story-gallery.tsx` (`images={story.flyer}`), gate `(story.flyer ?? []).length > 0`, heading `story:detail.flyer`. Key i18n baru `story:detail.flyer` (id/en). Tanpa komponen/dependency baru.
- **Iterasi publish/approve + dialog shared**: `story-form.tsx` memakai `components/shared/publish-schedule-dialog.tsx` (Dialog pilih `publishedAt` → AlertDialog konfirmasi) menggantikan `Dialog` inline; tombol **Terbitkan** dan **Setujui** (banner `REQUEST`) membuka dialog yang sama. State lokal `publishAt` dihapus. `APPROVED` deprecated (baris legacy tetap dirender). Key i18n baru `story:publishDialog.confirmDescription` (id/en).
- **Iterasi aksi editor + label visibilitas**: blok `actions` `story-form.tsx` dirombak — **Simpan** selalu (label `saveAsDraft` saat `status === 'DRAFT'`), **Simpan sebagai Draft** bila `status === 'PUBLISHED' || (canPublishStory && status === 'APPROVED')`, **Terbitkan** bila `canPublishStory && status !== 'REQUEST'`. Lihat §8. Label `visibilityOptions.PRIVATE` diganti "Privat"→"Khusus Member" / "Private"→"Members Only" (enum API tetap `PRIVATE`).
- **Iterasi endpoint transisi editor**: `StoryFormProps.onSubmit` jadi `(payload, action: StoryFormAction)`. Editor Setujui/Tolak tidak lagi lewat `PATCH status`; `story-edit.tsx` men-save field dulu (`PATCH /posts/:id`, `publishedAt` dibuang untuk approve) lalu `POST /posts/:id/approve { publishedAt }` (`useApproveStory`, `features/story/hooks/use-approve-story.ts`) / `POST /posts/:id/reject` (`useRejectStory`). API baru `approveStory`/`rejectStory` di `features/story/api/posts.ts`; invalidate `['story']` + `['story', { id }]`. `isPending` gabungan `updateStory` + `approveStory` + `rejectStory`. Key i18n baru `story:toast.{approved,rejected,approveFailed,rejectFailed}` (id/en).


## 15. TODO Iterasi Berikutnya

- ✅ Implementasi `features/story/` (api/hooks/components/types) + 3 route sesuai §3.
- ✅ Tambah item sidebar **Story** (`app-shell.tsx`) + key `dashboard:nav.story`.
- ✅ Registrasi namespace i18n `story` (§11).
- ✅ Upload gambar: konsumsi `POST /images` (multipart field `file`) → simpan `{ id, url }` + `variants`; guard tipe & ukuran di FE; non-422 → toast via helper, 422 → pesan di komponen editor/thumbnail.
- ✅ Kirim `imageIds` (gabungan id gambar inline baru + id thumbnail); saat edit cukup id gambar **baru**. `/categories` idempotent: respons existing tetap dipilih.
- **Implementasi `srcset` dari `variants`** pada node image TipTap & preview: petakan `large`/`medium` sebagai 1x/2x (atau `srcset` dengan `w`-descriptor) — **TODO**, bukan wajib iterasi ini.
- Cleanup orphan S3 (gambar lama yang dilepas dari content) — **backend TODO**, bukan iterasi FE.
- Filter lanjutan (status/tanggal) di halaman list — jika dibutuhkan UI filter, tambahkan setelah list dasar stabil.
- Opsional: `@tailwindcss/typography` (`prose`) bila styling konten butuh; tambah hanya jika terbukti perlu.
- ✅ Iterasi layout list: tambah mode **Card/List** dengan toggle (§7) — komponen `story-card.tsx`, tabel dirampingkan ke data yang sama + Aksi.
- ✅ Verifikasi: `pnpm lint` (0 error) + `pnpm exec tsc -p tsconfig.app.json --noEmit` (bersih) + `pnpm build` (sukses).
- ✅ Iterasi drag & drop gambar di editor Story: upload bersama `uploadAndInsert(file, at?)`, insert pada posisi drop, multi-file urut, overlay + key `story:editor.dropHere` (HTML5 DnD native, tanpa dependency baru).
- Alur status Story (dropdown Simpan + Setujui/Tolak saat `REQUEST`) — **selesai di FE**; batasan backend (§14) dicatat, tanpa perubahan backend.
- ✅ Iterasi galeri + dropzone: `gallery-upload.tsx` (urut, reorder native DnD + keyboard, dropzone), dropzone thumbnail, mime tanpa GIF, `galleryImageIds`/`gallery`, key `story:gallery.*` + `story:thumbnail.formats`. Verifikasi `pnpm lint` (0 error, 7 warning pre-existing) + `pnpm exec tsc -p tsconfig.app.json --noEmit` (bersih).
- ✅ Iterasi halaman detail read-only `/stories/:id` — §16.
- ✅ Upload flyer pada form create/edit (paralel galeri, `i18nPrefix="flyer"`, `flyerImageIds`, `Story.flyer`). *(historis — `flyerImageIds`/array `Story.flyer` sudah tidak berlaku; lihat revisi flyer bertipe di §15/§16.)*
- ✅ Render flyer read-only di halaman detail `/stories/:id` (reuse `story-gallery.tsx`, gate `flyer.length > 0`, heading `story:detail.flyer`, setelah Galeri) — lihat §16. *(historis — heading `story:detail.flyer` & array `flyer` sudah tidak berlaku; kini satu section per grup bertipe dengan heading dari `labelForType`.)*

## 16. Halaman Detail Story (read-only, `/stories/:id`)

Route `stories/:id` (`app/routes/story-detail.tsx`) di dalam `DashboardLayout` (`ProtectedRoute`); daftar route `stories/new` (statis) tetap menang atas `stories/:id` di ranking React Router.

- **Data**: `useStory(id)` → `getPost(id)` (`GET /posts/:id`). Tanpa endpoint/mutation baru.
- **Gate**: `useAuthPermissions().can('story:read')` di komponen; tanpa izin → empty-state `story:errors.forbidden`. Selain route editor/list (yang sudah di-gate), gate read tetap dicek karena route dapat diakses langsung via URL.
- **State**: `isPending` → `<Skeleton>`; `isError` + `isForbiddenError` → empty-state `ShieldAlert`; error lain → banner `story:errors.loadDetail` + refetch (`common:actions.retry`); `!id`/tanpa data → `story:detail.notFound`.
- **Layout bare**: `AppShell` mendeteksi `isStoryDetail = /^\/stories\/(?!new$)[^/]+$/` (mengecualikan `new`; `/edit` tidak match karena ada segmen tambahan) dan `return <Outlet />` — **tanpa** `TooltipProvider`, sidebar, header/breadcrumb, atau padding wrapper. Ditempatkan setelah semua hook `useMemo` (aturan hooks) dan sebelum branch editor. `/stories/new` & `/stories/:id/edit` tidak terpengaruh.
- **Back button tunggal**: `Button` ikon `ArrowLeft`, `absolute left-4 top-4 z-20`, glass (`bg-background/70 backdrop-blur border shadow-sm`, `rounded-full`), `aria-label`/`title` `story:detail.back`. Aksi: `navigate(-1)` bila `location.key !== 'default'`, fallback `navigate('/stories')` (entry pertama/tab baru).
- **View** `features/story/components/story-detail.tsx` (presentational, props `{ story: Story; className?: string }`):
  - Hero: `thumbnail` `aspect-[21/9] object-cover` + gradient overlay `from-background`; judul + meta di-overlay bawah (`max-w-3xl mx-auto`). `thumbnail` null → header fallback (`border-b bg-muted/30`, `pt-20` memberi ruang back button) — tanpa `<img>` rusak.
  - Meta: `Avatar` (fallback inisial dari `creator.fullName`), nama + `formatDateTime(publishedAt)`, badge status (`STATUS_VARIANT`) & visibilitas (`VISIBILITY_VARIANT`) via key `story:statusOptions.*`/`story:visibilityOptions.*`. Author kosong → `story:detail.authorFallback`.
  - Konten: `max-w-3xl mx-auto` + utility `[&_...]` meniru tipografi `RichTextEditor` (tanpa prefix ProseMirror); dirender via `dangerouslySetInnerHTML` (HTML dari API/editor kaya teks — konsisten, **tidak** menambah dependency sanitizer). Kosong/whitespace → `story:detail.noContent`.
  - Galeri: `story-gallery.tsx` disembunyikan bila `gallery` kosong.
  - Flyer: dirender read-only tepat setelah Galeri — satu `<section>` per grup (`story.flyer: FlyerGroup[]`), gate `group.images.length > 0`, `key={`${group.type}-${index}`}` (indeks mencegah kolisi data legacy), heading `labelForType(group.type, t)` (id preset → `story:flyer.presets.*`, custom → teks mentah), isi reuse `story-gallery.tsx` prop `images={group.images}`. Tidak ada komponen baru; `StoryGallery` tetap memakai key `story:gallery.*` untuk preview/counter/aria.
- **Galeri** `features/story/components/story-gallery.tsx` (presentational, props `{ images: UploadedImage[]; className?: string }`): grid `grid-cols-2 md:grid-cols-3` (varian `thumbnail` fallback `url`), klik buka lightbox `Dialog` `max-w-3xl` (varian `large` fallback `url`, `max-h-[70vh] object-contain`), navigasi wrap-around `ChevronLeft`/`ChevronRight` + keyboard `ArrowLeft`/`ArrowRight`, counter `{{current}} / {{total}}`. `aria-label` tombol + alt gambar dari `filename`; dialog keyboard-closeable. Menggunakan ulang key `story:gallery.*` yang sudah ada.
- **i18n baru**: `story:detail.{back,notFound,authorFallback,noContent,gallery}` di `en` & `id` (key identik; `story:detail.flyer` **sudah tidak dipakai** — heading flyer dari `labelForType` → `story:flyer.presets.*`). Hero `thumbnail` null memakai header fallback tanpa `img` (tidak butuh key alt).
- **Verifikasi**: `pnpm lint` (0 error, 8 warning pre-existing) + `pnpm exec tsc -p tsconfig.app.json --noEmit` (bersih).
- **Add author dari form**: field author (`UserCombobox`, `story-meta-panel`) punya tombol `Plus` (prop `canCreate`/`onCreateClick`, i18n `user:addAuthor`) yang membuka `AuthorCreateDialog` (`features/user/components/author-create-dialog.tsx`); author baru langsung masuk options (list + refetch `['users']`) **tanpa auto-dipilih** — admin memilih manual di `authorIds`. Admin (`user:delete` + `admin:access`) juga punya aksi hapus author di dropdown (`canDeleteOption`/`onDeleteOption` → `AuthorDeleteDialog`, `DELETE /users/:id?cascadeContent=true`) yang **ikut menghapus** semua story/event/archive milik author tsb — destruktif, tanpa undo. Lihat `user.md` §10–§11.
