# Module: Event — Brief

Dokumen ini mencatat implementasi halaman **Event** pada frontend React — list event + editor create/edit. Menu Event **meniru pola modul `story`** (list/create/edit) dengan perbedaan hanya pada kartu settings (kolom DB `events`). Mengikuti konvensi `frontend/AGENTS.md`.

> **Status**: ✅ Implementasi frontend selesai. Backend modul `event`/`event-type` dibangun paralel; FE disusun terhadap kontrak di `docs/brief-event-menu.md`.

## 1. Routing

Didaftarkan di `src/app/routes/index.tsx` sebagai child `DashboardLayout`.

```
/                      (parent → DashboardLayout, ProtectedRoute)
├── /events             → list (card/tabel)   — RequirePermission code="event:read"
├── /events/new         → editor create        — gate event:create di komponen
├── /events/:id/edit    → editor edit          — gate event:update di komponen
└── /events/:id         → detail read-only     — gate event:read di komponen (pola story-detail)
```

- `/events` menjalankan **dispatcher** `EventsPage` (`events.tsx`): `AdminEventsPage` (punya `event:approve` **atau** `event:publish`) atau `OrgEventsPage` (`events-org.tsx`) — lihat §11.

- Route **detail** (`/events/:id`) menyembunyikan sidebar lewat branch `isEventDetail` di `app-shell.tsx` (`/^\/events\/(?!new$)[^/]+$/`) → `<Outlet />` polos (tanpa sidebar/header). Regex tidak menangkap `/events/:id/edit` (`[^/]+$`) maupun `/events/new` (lookahead).

- Route **editor** menyembunyikan sidebar lewat branch `isEventEditor` di `app-shell.tsx` (`pathname === '/events/new' || /^\/events\/[^/]+\/edit$/`) → header ringkas + breadcrumb `Dashboard / Event / judul`, full-height desktop.
- Sidebar: item **Event** (ikon lucide `CalendarDays`, `permission: 'event:read'`) di grup Dashboard (`dashboardNavItems`).

## 2. Struktur Folder

```
src/app/routes/
├── events.tsx           # halaman list (state page/search/sort/view, mutation, dialog hapus)
├── event-new.tsx        # halaman create (container form editor)
├── event-edit.tsx       # halaman edit (container form editor, load detail)
└── event-detail.tsx     # halaman detail read-only (gate event:read, hero + konten + info card)

src/features/event/
├── api/
│   ├── events.ts        # listEvents, getEvent, createEvent, updateEvent, deleteEvent
│   ├── event-types.ts   # listEventTypes, createEventType
│   └── images.ts        # uploadImage (multipart file + entityType='event')
├── hooks/
│   ├── use-events.ts             # query ['event', {page,limit,search,sortBy,sortOrder}], keepPreviousData
│   ├── use-event.ts              # query ['event', {id}]
│   ├── use-create-event.ts       # mutation → invalidate ['event']
│   ├── use-update-event.ts       # mutation → invalidate ['event'] + ['event', {id}]
│   ├── use-submit-event.ts       # mutation POST /events/:id/submit → invalidate ['event'] + ['event', {id}]
│   ├── use-delete-event.ts       # mutation → invalidate ['event']
│   ├── use-event-types.ts        # query ['event-types'], staleTime ≥ 60s
│   ├── use-create-event-type.ts  # mutation POST /event-types → invalidate ['event-types']
│   └── use-upload-image.ts       # mutation POST /images (thumbnail & inline editor; tanpa invalidate list)
├── lib/
│   ├── schema.ts        # createEventSchema (zod) + EventFormValues + EMPTY_EVENT_VALUES
│   ├── format.ts        # formatEventDateLines (tanggal + jam terpisah) + formatEventDate (tanggal · jam)
│   └── slug.ts          # slugify (cermin utils backend, fallback 'event')
├── components/
│   ├── event-form.tsx             # form editor dipakai create & edit
│   ├── event-meta-panel.tsx       # panel kanan: name → slug → thumbnail → eventTypes → dates → location
│   ├── event-type-combobox.tsx    # multi-select tipe event + tambah inline
│   ├── event-dates-field.tsx      # list tanggal (DatePicker + TimePicker shared, tambah/hapus)
│   ├── event-location-field.tsx   # lokasi (name + address + map), form-aware
│   ├── location-map-picker.tsx    # Leaflet MapContainer + OSM + Marker draggable (presentational)
│   ├── event-table.tsx            # tabel list
│   ├── event-card.tsx             # kartu list (creator: organisasi → fallback fullName)
│   ├── event-detail.tsx           # presentational detail (hero, HTML content, grid 2/3 kolom)
│   ├── event-info-card.tsx        # side card: blok tanggal per EventDate + lokasi + aksi
│   ├── event-location-map.tsx     # peta read-only (1 marker, semua interaksi mati)
│   └── status-variant.ts          # peta ContentStatus → Badge variant
└── types.ts
```

Komponen shared hasil promosi (dipakai story + event): `src/components/shared/rich-text-editor.tsx`, `src/components/shared/thumbnail-upload.tsx`, `src/lib/use-file-drop.ts`, type gambar `src/types/image.ts`. Ditambah `src/components/shared/date-picker.tsx` (pemilih tanggal saja `"YYYY-MM-DD"` via Popover + Calendar single, dipakai `EventDatesField`) dan `src/components/shared/time-picker.tsx` (pemilih jam `"HH:mm"` via Popover + Select, dipakai `EventDatesField`).

## 3. Dependency

- `leaflet` + `react-leaflet` v5 (React 19) + `@types/leaflet` (dev).
- `import 'leaflet/dist/leaflet.css'` sekali di `location-map-picker.tsx`.

## 4. Kontrak API

Envelope: sukses `{ data, message }`; list `{ data, message, meta: { page, limit, total } }`; error `{ statusCode, message, errors }`. Unwrap sekali di `lib/api-client.ts`.

| Metode | Endpoint | Body/Param | Keterangan |
| --- | --- | --- | --- |
| GET | `/events?page=&limit=&search=&sortBy=&sortOrder=` | `search` OR `name, slug` | list; item menyertakan `eventTypes: {id,name}[]`, `dates: { date, startTime, endTime }[]`, `location` |
| GET | `/events/:id` | — | detail termasuk `content`, `approvedAt` |
| POST | `/events` | `{ name, slug?, content?, thumbnail?, publishedAt?, status?, visibility?, eventTypeIds?, dates?, location }` | 201; 409 slug duplikat; 422 validasi. `location` **wajib**; `visibility` ∈ `PUBLIC\|PRIVATE` (default `PUBLIC`) |
| PATCH | `/events/:id` | partial | `eventTypeIds`/`dates`/`location` bila dikirim = replace-all |
| POST | `/events/:id/submit` | — | ajukan terbit (`event:submit`); backend mengabaikan `status` PATCH bagi non-admin |
| DELETE | `/events/:id` | — | 200 |
| GET | `/event-types?limit=100` | — | opsi tipe event (`event-type:read`) |
| POST | `/event-types` | `{ name }` | inline create (`event-type:create`), idempotent |
| POST | `/images` | multipart `file` + `entityType='event'` | 201 `{ id, url, variants[] }`; `url` absolut |

Item tanggal: response `{ date: string /* ISO datetime UTC midnight */, startTime: string \| null /* "HH:mm" */, endTime: string \| null }`; payload `{ date: string /* "YYYY-MM-DD" */, startTime?: string /* "HH:mm" */, endTime?: string /* "HH:mm" */ }` (start/end di-drop bila kosong).

Lokasi: `{ name, address?, lat?, lng? }`. FE menyimpan `lat`/`lng` sebagai **string** (aman terhadap kolom DECIMAL), dikonversi ke `number` saat submit; hanya dikirim bila terisi.

## 5. List (`/events`) — Search / Sort / Pagination

Container `src/app/routes/events.tsx`. Dua mode tampilan (default **card**) via `Toggle` `LayoutGrid`/`List`.

- **SearchBar** (`components/shared/search-bar.tsx`): placeholder `event:search.placeholder` ("Cari nama atau slug event..."), debounce 400 ms (`useDebouncedValue`), dikirim hanya bila `trim ≥ 2` (`appendListParams`). Ubah search → `setPage(1)`. Empty state membedakan "Belum ada event" vs `Tidak ditemukan untuk "<term>"` + Reset.
- **Kolom `searchable` backend**: `name`, `slug`.
- **Kolom tampil + SortableHeader**: hanya kolom yang didukung whitelist `EVENT_SORT_FIELDS` backend (`name`, `slug`, `status`, `visibility`, `publishedAt`, `createdAt`, `updatedAt`). Yang tersedia di tabel: `name`, `status`, `visibility`, `publishedAt`. Klik cycle `asc → desc → null` via `nextSort`; ubah sort → `setPage(1)`.
- **Kolom non-sortable** (bukan whitelist `sortBy` backend, dirender `<TableHead>` biasa tanpa `SortableHeader`): `thumbnail`, `eventTypes`, `dates`, `location`. Menekan header ini tidak memicu 422 `assertAllowedSort`.
- **Pagination** (`DataTablePagination`): `Total N Event · halaman P`, server-side.
- **Query key**: `['event', { page, limit, search, sortBy, sortOrder }]`, `placeholderData: keepPreviousData`.
- **Toast CUD** di call-site page: sukses `event:toast.*`; gagal non-422 `toastError(getApiErrorMessage(...))`; 422 early-return (`isValidationError`) → per-field.
- Contoh query: `/events?page=1&limit=10&search=gamelan&sortBy=publishedAt&sortOrder=desc`.

## 6. Editor (`/events/new` & `/events/:id/edit`)

Satu komponen `EventForm` dipakai ulang; container memuat data (`useEvent(id)`) dan menyerahkan `initialValues`. Layout identik story: grid 70/30 (editor konten + panel settings), toggle settings, **tepat 2 tombol aksi** di header settings **dan** toolbar saat settings disembunyikan: **Simpan sebagai Draft** (selalu, `requestStatusChange('DRAFT', …)`) + **Terbitkan** bila `canPublishEvent` (`event:publish`, `openPublishDialog()` → dialog `DateTimePicker` → `submitWithStatus('PUBLISHED', publishAt)`) **atau** **Ajukan untuk Terbit** bila hanya `canSubmitEvent` (`event:submit`, `requestStatusChange('REQUEST', …)`). Dropdown lama (Simpan perubahan/request) dihapus. Banner `status === 'REQUEST'`: **Setujui** hanya bila `canApproveEvent` (`event:approve`), **Tolak** hanya bila `canRejectEvent` (`event:reject`), selain itu hanya teks menunggu tanpa tombol. Semua aksi status lewat `AlertDialog` konfirmasi (validasi `form.trigger()` dulu).

**Urutan field settings** (create & edit): `name → slug → visibility → thumbnail → eventTypes → eventDates → location`. Gallery & `categoryIds` **tidak ada** (bukan kolom event). Dialog Terbitkan (`publishedAt`) memakai `components/shared/date-time-picker.tsx` (butuh tanggal + jam); baris tanggal event memakai `components/shared/date-picker.tsx` (tanggal saja) + `time-picker.tsx`.

- `name`/`slug`: input teks; auto-slug saat create, berhenti setelah slug disentuh; 409 slug → per-field.
- `visibility`: `Select` shadcn (bukan input native) — opsi `PUBLIC`/`PRIVATE` dari `VISIBILITIES`, label `event:visibilityOptions.*`, default `PUBLIC`; ikut payload create/update.
- `thumbnail`: `ThumbnailUpload` shared (upload `POST /images`, preview, hapus, dropzone).
- `eventTypes`: `EventTypeCombobox` multi-select + tambah inline (`POST /event-types`); gate `event-type:create`.
- `eventDates`: `EventDatesField` — tiap baris header `Day N` + tombol hapus, `DatePicker` (tanggal saja `"YYYY-MM-DD"`, satu baris penuh) + `TimePicker` (jam mulai & selesai, opsional, grid 2 kolom); tambah/hapus baris menambah/menghapusnya; nilai tanggal date-only, jam `"HH:mm"` ('' bila kosong).
- `location`: `EventLocationField` → `name` (wajib), `address` (opsional), `LocationMapPicker` (klik map / geser marker → lat/lng, plus pencarian alamat Nominatim).
- Validasi RHF + zod (`createEventSchema`), pesan dari `t('validation:*')`; 422/409 dipetakan per-field via `mapApiFieldErrors`; banner hanya non-422.

## 6a. Detail (`/events/:id`)

Halaman read-only full-bleed (tanpa sidebar/header). Container `app/routes/event-detail.tsx` (gate `can('event:read')`, `useEvent(id, canRead)`, tombol back melayang, skeleton/error/forbidden/not-found) → presentational `features/event/components/event-detail.tsx`.

- **Hero**: `aspect-[21/9] object-cover` + overlay gelap; fallback tanpa thumbnail memakai gradient token (`from-primary`). Badge `eventTypes` + status (`STATUS_VARIANT`) + visibility (`VISIBILITY_VARIANT`) di atas `<h1>` (`text-4xl md:text-5xl`); baris creator + `publishedAt`.
- **Body**: grid `lg:grid-cols-3` — konten HTML (2/3, `dangerouslySetInnerHTML` + `sanitizeHtml`, `CONTENT_CLASS` meniru story-detail) + aside (1/3) berisi `EventInfoCard`.
- **`EventInfoCard`**: blok tanggal per `EventDate` (nomor hari besar + bulan/tahun + hari + jam via `getEventDateParts`), lokasi (nama + alamat), tombol "Buka di Maps" (`https://www.google.com/maps?q=<lat>,<lng>`, tab baru), salin alamat (`navigator.clipboard` + toast), peta read-only. Section hilang bila data kosong.
- **`EventLocationMap`**: read-only Leaflet — `dragging/scrollWheelZoom/doubleClickZoom/boxZoom/keyboard/touchZoom/zoomControl` false + `Marker interactive={false}`; hanya render bila lat/lng `number` valid. Terpisah dari `LocationMapPicker` (yang berorientasi edit + pencarian Nominatim) agar detail tidak menarik logika editor.
- **`getEventDateParts`** (`lib/format.ts`) — baca komponen UTC (`toDateOnly`) + Date lokal tengah hari agar hari tidak bergeser; label bulan/hari dari `formatDate` (locale browser).
- Sticky `lg:sticky lg:top-8` pada card; mobile otomatis stack.

## 7. Permissions

| Route / Aksi | Kode |
| --- | --- |
| `/events` (list) | `event:read` (`RequirePermission`) |
| `/events/:id` (detail) | `event:read` (gate di komponen, pola `story-detail`) |
| Editor create | `event:create` |
| Editor edit | `event:update` |
| Tombol Tambah | `event:create` |
| Aksi Edit | `event:update` |
| Aksi Hapus + `DELETE` | `event:delete` |
| `GET /event-types` | `event-type:read` |
| `POST /event-types` | `event-type:create` |
| Tombol Terbitkan / `submitWithStatus('PUBLISHED')` | `event:publish` |
| Tombol Ajukan untuk Terbit / `POST /events/:id/submit` | `event:submit` |
| Banner Setujui (`status=APPROVED`) | `event:approve` |
| Banner Tolak (`status=DRAFT`) | `event:reject` |
| Menu sidebar Event | `event:read` |

## 8. i18n

- Namespace baru `event`: `src/i18n/locales/{en,id}/event.json`, didaftarkan di `src/i18n/index.ts`.
- `dashboard:nav.event` ditambahkan di `{en,id}/dashboard.json`.
- Validasi baru di namespace `validation`: `eventNameRequired`, `eventNameMax`, `eventSlugMax`, `eventSlugPattern`, `eventLocationRequired`, `eventLocationMax`, `eventAddressMax`.
- `event:location.search*` (`searchPlaceholder`, `searching`, `searchNoResults`, `searchHint`) untuk pencarian alamat Nominatim.
- `event:form.startTime`/`event:form.endTime`/`event:form.timePlaceholder` untuk label & placeholder jam pada `EventDatesField`.
- `event:form.visibility` + `event:visibilityOptions.{PUBLIC,PRIVATE}` + `event:table.visibility` untuk kontrol & badge visibilitas.
- `event:detail.*` (en/id): `back`, `notFound`, `creatorFallback`, `noContent`, `dates`, `location`, `openInMaps`, `copyAddress`, `addressCopied`, `addressCopyFailed`, `mapAlt`.

## 9. Verifikasi

- `pnpm lint` → **0 error**, 8 warning pre-existing (shadcn `react-refresh`, `auth-provider`, React Compiler `RegisterForm`/`profile-card`), tanpa warning baru. (Dokumen lama menyebut 7; hitungan aktual 8.)
- `pnpm exec tsc -b --noEmit` → **5 error TS2322 pre-existing di `src/features/billing/components/billing-form-dialog.tsx`** (file WIP untracked, di luar modul event). File `event-detail*`/`event-info-card`/`event-location-map` sendiri **0 error**.
- `pnpm build` (`tsc -b && vite build`) → **gagal** karena 5 error billing di atas (unrelated, untracked). Perbaiki billing dulu; modul event tidak menambah error.

## 10. Catatan

- `status` ikut pada payload create/update (mengikuti alur workflow story); kontrak brief tidak menyebut eksplisit — samakan dengan `posts`.
- Event **tidak punya** `imageIds`/gallery di payload; gambar inline editor tetap diupload tapi tidak di-bind ke event (hanya URL di `content`).
- Komponen `rich-text-editor`/`thumbnail-upload` dipromosikan ke `components/shared/` (dipakai story + event); label editor masih memakai namespace `story:editor.*` (teks identik) — calon perbaikan: parameterisasi namespace bila label perlu dibedakan.
- E2E menunggu backend modul `event`/`event-type` siap.
- **Iterasi visibilitas**: field `visibility` (`PUBLIC`/`PRIVATE`, default `PUBLIC`) ditambahkan ke `Event`/`CreateEventInput`, zod schema, form (Select shadcn), tabel (kolom badge `VISIBILITY_VARIANT` + `SortableHeader` field `visibility`), dan i18n (`en`/`id`). Sort server-side via `sortBy=visibility`; wiring generik page/api/hook meneruskan `sortBy`/`sortOrder` tanpa perubahan.
- **Iterasi tanggal date-only**: baris tanggal event jadi tanggal saja (`"YYYY-MM-DD"`) via `components/shared/date-picker.tsx`; jam tetap di `TimePicker` terpisah. Backend `EventDateDto.date` (`@IsISO8601()`) menerima `"YYYY-MM-DD"`, menyimpan UTC midnight, dan mengembalikan ISO datetime — FE mengubahnya balik ke date-only lewat `toDateOnly` (`features/event/lib/format.ts`, baca komponen UTC) di `event-edit.tsx:toFormValues`. Submit `event-form.tsx` mengirim `date` apa adanya `"YYYY-MM-DD"` dan tetap drop `startTime`/`endTime` kosong (edit boleh `dates: []`). `formatEventDate` membangun Date lokal tengah hari dari bagian `"YYYY-MM-DD"` agar hari tidak bergeser timezone. `schema.ts` tetap `date: z.string()`.
- **Iterasi badge card**: badge status dipindah dari `CardContent` ke **overlay pojok kiri-atas thumbnail** (`absolute left-2 top-2 z-10`, `shadow-sm`) di `event-card.tsx`; badge `memberOnly` (`variant="secondary"`, `shadow-sm`) muncul bila `visibility === 'PRIVATE'`. Key i18n baru `event:card.memberOnly` (`Khusus Member`/`Members Only`). Blok tanggal (`CalendarDays` + daftar) kini langsung sebagai child `CardContent` (pembungkus `flex items-start justify-between` + badge dihapus). `VISIBILITY_VARIANT` tidak diimpor di card (hanya `STATUS_VARIANT`). Tanpa perubahan query/payload.
- **Iterasi grid card responsif**: string grid tetap `gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` di `event-card.tsx` + `EventsCardSkeleton` diganti `CARD_GRID_CLASS` dari `components/shared/card-grid.ts` (`grid gap-4 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]`) — jumlah kolom mengikuti lebar layar native (CSS Grid `auto-fill`), konstanta sama dipakai modul story. Tanpa JS, tanpa dependency baru; `auto-fill` (bukan `auto-fit`) menjaga lebar kartu saat item sedikit.
- **Iterasi gate aksi workflow + endpoint submit**: tombol aksi `EventForm` jadi 2 `Button` berbasis permission (tanpa nama role) — lihat §6. `event-new.tsx`: bila `payload.status === 'REQUEST'` create dulu sebagai `DRAFT` lalu `submitEvent.mutateAsync(created.id)`; `event-edit.tsx`: setelah update, bila `payload.status === 'REQUEST'` dan `updated.status === 'DRAFT'` → `submitEvent.mutateAsync(id)`. `submissionError` hanya dari `create/updateEvent.error` (error `submitEvent` di-toast terpisah, tidak ke form — cegah 409 submit salah jadi error `slug`); create + submit gagal → navigate `/events/:id/edit` agar tidak submit ulang/duplikat. `isPending` gabungan. Komponen tetap presentational (props boolean `canPublishEvent/canSubmitEvent/canApproveEvent/canRejectEvent`).
- **Iterasi creator card**: kartu tidak lagi menampilkan tanggal publish (`formatDateTime(event.publishedAt)` dihapus dari `CardContent`, import `formatDateTime` dibuang). Posisinya diganti baris creator (ikon `Building2` + teks, pola sama baris lokasi): `event.creator?.organization?.name ?? event.creator?.fullName ?? '—'`. Type `EventCreator { id, fullName, organization: { id, name } | null }` + field `creator: EventCreator | null` ditambahkan di `types.ts` (kontrak API baru). Tanpa key i18n baru (nilai = data). Kolom `publishedAt` di `event-table.tsx` tetap.

## 11. Dual View `/events` (Admin vs Non-Admin)

Dispatcher `EventsPage` (`app/routes/events.tsx`) memilih view **hanya dari permission** (tanpa nama role): `canAny(['event:approve', 'event:publish', 'event:reject', 'event:unpublish'])` via `useAuthPermissions()` — sepadan scope `all` backend (`access-scope.service.ts`); role org/member tidak memilikinya.

- **Admin** → `AdminEventsPage` (internal, JSX/behavior tidak berubah): toggle card/tabel, search, sort, pagination, dialog hapus.
- **Non-admin** → `OrgEventsPage` (`app/routes/events-org.tsx`): header dengan tombol "Tambah" (gate `event:create`) + dua seksi bertumpuk. Empty state tiap seksi juga menampilkan CTA "Tambah" bila `event:create`.
- Error ditangani **per-seksi** (tidak saling menyembunyikan): tiap section punya `isPending`/`errorMessage` sendiri; 403 → `event:errors.forbidden`, selain itu `event:errors.loadData`.

### Seksi 1 — "Event bulan ini"
- `EventMonthSection` (`features/event/components/event-month-section.tsx`), grid horizontal `CARD_GRID_CLASS`.
- State bulan di container (default bulan berjalan, tanggal 1 lokal); tombol prev/next. Label bulan locale browser lewat `formatDate(month, undefined, { dateStyle: undefined, month: 'long', year: 'numeric' })` — tanpa formatter lokal baru.
- Kartu: nama, lokasi (`event.location?.name`), tanggal (`formatEventDate`), badge `event.eventTypes`, tombol "Lihat Event" → `/events/{id}`. Empty state bila tidak ada.

### Seksi 2 — "My Event"
- `MyEventList` (`features/event/components/my-event-list.tsx`) — `Table` dengan kolom Date, Event Name (thumbnail + title), Location (name + address), Category (`eventTypes` badges), Status (`STATUS_VARIANT` + `event:statusOptions.*`), Actions.
- Kolom Date memakai `formatEventDateLines` (`lib/format.ts`): tiap `EventDate` dirender **tanggal dulu, lalu `<br/>`, lalu jam** (jam hilang → hanya tanggal, tanpa `<br/>`). Antar tanggal ditumpuk **vertikal** dalam `<div className="flex flex-col gap-2">` sehingga `gap-2` memberi jarak vertical antar hari (tanpa separator `<br />` antar entri). `formatEventDate` (tanggal + ` · ` + jam dalam satu string) tetap dipakai `event-card`/`event-table`/`event-month-section` — perilaku tak berubah (kini delegasi ke `formatEventDateLines`).
- Actions: tombol "Detail" → `/events/{id}`, dropdown `MoreHorizontal`: Edit (`Pencil`, gate `event:update`) + Delete (`Trash2`, gate `event:delete`) — item disembunyikan bila gate false.
- Delete memakai `useDeleteEvent` + `AlertDialog` + pola toast yang sama dengan `events.tsx`.

### Sumber data, `mine` & `eventMonth`
- `GET /events` menerima `mine=true`: event seorganisasi bila user punya organisasi, selain itu hanya event milik user. Seksi "My Event" memakai `useEvents({ page: 1, limit: 100, mine: true })`; seksi "Event bulan ini" tetap scoped tanpa `mine`. Tanpa endpoint "mine" baru.
- `GET /events` menerima `eventMonth=YYYY-MM` (backend paralel: event dengan ≥1 tanggal di bulan UTC tsb).
- `ListEventsParams` (`api/events.ts`) extends `ListParams` + `eventMonth?` + `mine?` (serialisasi `mine=true`); `useEvents` menerima keduanya, meneruskan ke `listEvents`, dan memasukkannya ke queryKey. `keepPreviousData` + `staleTime` tetap.
- Query: seksi bulan `useEvents({ page: 1, limit: 100, eventMonth })`; seksi list `useEvents({ page: 1, limit: 100, mine: true })`. Ponytail: tanpa pagination — tambah bila bisa >100.

### i18n (`event:org.*`, `en`/`id`)
`monthTitle`, `prevMonth`, `nextMonth`, `emptyMonth`, `viewEvent`, `myTitle` ("My Event" en/id), `emptyList`, `columnDate`, `columnEventName`, `columnCategory`, `detail`. Reuse: `event:add`, `event:table.location`, `event:table.status`, `event:table.edit`, `event:table.delete`, `event:errors.loadData`, `event:errors.forbidden`, `common:table.actions`, `common:table.actionsFor`, `event:statusOptions.*`, `event:delete.*`, `event:toast.*`.

