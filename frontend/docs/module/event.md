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
│   ├── city-select.tsx            # single-select kota + tambah inline (POST /cities)
│   ├── event-dates-field.tsx      # list tanggal (DatePicker + TimePicker shared, tambah/hapus)
│   ├── event-location-field.tsx   # lokasi (Venue + geo cascade Country→State→City + address + link Google Maps), form-aware
│   ├── event-table.tsx            # tabel list
│   ├── event-card.tsx             # kartu list (kredit: getEventCreditName — organizer → authors → createdBy)
│   ├── event-detail.tsx           # presentational detail (hero, HTML content, grid 2/3 kolom)
│   ├── event-info-card.tsx        # side card: blok tanggal per EventDate + lokasi + aksi
│   ├── event-location-map.tsx     # peta read-only (1 marker, semua interaksi mati)
│   └── status-variant.ts          # peta ContentStatus → Badge variant
└── types.ts
```

Komponen shared hasil promosi (dipakai story + event): `src/components/shared/rich-text-editor.tsx`, `src/components/shared/thumbnail-upload.tsx`, `src/lib/use-file-drop.ts`, type gambar `src/types/image.ts`. Ditambah `src/components/shared/date-picker.tsx` (pemilih tanggal saja `"YYYY-MM-DD"` via Popover + Calendar single, dipakai `EventDatesField`) dan `src/components/shared/time-picker.tsx` (pemilih jam `"HH:mm"` via Popover + Select, dipakai `EventDatesField`). Kartu media `EventHighlightCard` dipromosikan dari dashboard ke `src/components/shared/event-highlight-card.tsx` (dipakai dashboard non-admin + `EventMonthSection`; i18n `common:eventCard.*`).

## 3. Dependency

- `leaflet` + `react-leaflet` v5 (React 19) + `@types/leaflet` (dev).
- `import 'leaflet/dist/leaflet.css'` sekali di `features/event/components/event-location-map.tsx`.

## 4. Kontrak API

Envelope: sukses `{ data, message }`; list `{ data, message, meta: { page, limit, total } }`; error `{ statusCode, message, errors }`. Unwrap sekali di `lib/api-client.ts`.

| Metode | Endpoint | Body/Param | Keterangan |
| --- | --- | --- | --- |
| GET | `/events?page=&limit=&search=&sortBy=&sortOrder=&filter[status]=&eventTypeId=` | `search` OR `name, slug`; `eventTypeId` = UUID tipe event (param top-level) | list; item menyertakan `eventTypes: {id,name}[]`, `dates: { date, startTime, endTime }[]`, `location` |
| GET | `/events/:id` | — | detail termasuk `content`, `approvedAt` |
| POST | `/events` | `{ name, slug?, content?, thumbnail?, publishedAt?, status?, visibility?, eventTypeIds?, authorIds?, networkId?, dates?, location }` | 201; 409 slug duplikat; 422 validasi. `location` **wajib**; `visibility` ∈ `PUBLIC\|PRIVATE` (default `PUBLIC`); `networkId` = penyelenggara (UUID network, `null` = clear saat edit, diabaikan saat create) |
| PATCH | `/events/:id` | partial | `eventTypeIds`/`dates`/`location` bila dikirim = replace-all |
| POST | `/events/:id/submit` | — | ajukan terbit (`event:submit`); backend mengabaikan `status` PATCH bagi non-admin |
| DELETE | `/events/:id` | — | 200 |
| GET | `/event-types?limit=100` | — | opsi tipe event (`event-type:read`) |
| GET | `/networks?page=&limit=` | — | opsi penyelenggara (`network:read`); item `{ id, name, … }` |
| POST | `/event-types` | `{ name }` | inline create (`event-type:create`), idempotent |
| DELETE | `/event-types/:id` | — | 200; hapus tipe event (`event-type:delete`); combobox menampilkan aksi hapus per opsi + dialog konfirmasi |
| POST | `/cities` | `{ name, countryId, stateId }` | inline create kota (`city:create`), idempotent (nama case-insensitive + country/state sama → existing); 422 bila `countryId` tidak ada atau `stateId` bukan milik `countryId` |
| POST | `/images` | multipart `file` + `entityType='event'` | 201 `{ id, url, variants[] }`; `url` absolut |

Item `Event` menyertakan `network: { id: string; name: string } | null` — berasal dari relasi **`Event.network`** backend (organisasi event; diisi saat **approve** submission publik atau di-set admin), di samping `creator: { id, fullName, network } | null` yang sudah ada.

Row `Event` berstatus **`DRAFT`** dapat berasal dari **approve submission publik** (endpoint API `POST /event-submissions/:id/approve`, dikelola dari dashboard admin — **bukan route/halaman FE**): backend me-recreate konten submission menjadi `Event` `DRAFT` dengan `createdBy` = admin dan `networkId` dari `organiser` submission (find-or-create `Network`). Event `DRAFT` tsb tampil di list `/events` internal (permission `event:read`), diedit di `/events/:id/edit`, lalu **di-publish langsung** via alur publish existing (tombol **Terbitkan**, `event:publish`) — **tanpa** `event:submit`/`REQUEST`. Detail sisi admin: `docs/module/event-submission.md` §6 (aksi approve/reject) dan `docs/module/dashboard.md` §10h.

Item tanggal: response `{ date: string /* ISO datetime UTC midnight */, startTime: string \| null /* "HH:mm" */, endTime: string \| null }`; payload `{ date: string /* "YYYY-MM-DD" */, startTime?: string /* "HH:mm" */, endTime?: string /* "HH:mm" */ }` (start/end di-drop bila kosong).

Lokasi: `{ name, address?, mapsUrl?, countryId?, stateId?, cityId? }`. Server me-resolve `mapsUrl` (tautan Google Maps panjang/shortlink) menjadi `lat`/`lng`/`embedUrl` — form **tidak lagi** mengirim `lat`/`lng`. Field geo (`countryId`/`stateId`/`cityId`) disimpan sebagai string di form & dikonversi ke number saat submit (opsional, dibuang bila kosong). Response lokasi menyertakan relasi `country: { id, name, iso2 } | null`, `state: { id, name } | null`, `city: { id, name } | null` (plus `countryId`/`stateId`/`cityId`) serta field baru `mapsUrl: string | null` (tautan asli) dan `embedUrl: string | null` (URL embed keyless). Tautan tak ter-resolve → 422 dengan field `location.mapsUrl`. Field `entry` ∈ `FREE | TICKET` ditambahkan pada `Event`/`CreateEventInput`.

Geo cascade memakai endpoint publik `GET /cities?filter[countryId]=&filter[stateId]=&sortBy=name&sortOrder=asc` (`{ data: { id, name, countryId }[], meta }`) — lihat `features/geo/api/geo.ts:listCitiesByCountry` + `hooks/use-cities.ts` (`queryKey ['geo','cities',countryId,stateId]`, `enabled: Boolean(countryId && stateId)` — tidak menarik seluruh kota satu negara saat state belum dipilih; backend `/cities` juga mensyaratkan `stateId`).

**Find-or-create City inline** (pola `event-type`): `CitySelect` (`features/event/components/city-select.tsx`) single-select + baris tambah; create via `POST /cities` (`features/geo/api/geo.ts:createCity` + `hooks/use-create-city.ts`, invalidate `['geo','cities']`). Gate permission **`city:create`** (user harus re-login / refresh `/auth/me` agar permission baru muncul). Opsi hasil create di-merge lokal (dedupe by value) supaya label langsung tampil tanpa menunggu refetch. Toast gagal non-422 → `event:errors.createCityFailed`.

## 5. List (`/events`) — Search / Sort / Pagination

Container `src/app/routes/events.tsx`. Dua mode tampilan (default **card**) via `Toggle` `LayoutGrid`/`List`.

- **SearchBar** (`components/shared/search-bar.tsx`): placeholder `event:search.placeholder` ("Cari nama atau slug event..."), debounce 400 ms (`useDebouncedValue`), dikirim hanya bila `trim ≥ 2` (`appendListParams`). Ubah search → `setPage(1)`. Empty state membedakan "Belum ada event" vs `Tidak ditemukan untuk "<term>"` + Reset.
- **Filter**: dua `Select` (shadcn) setelah `SearchBar`, sebelum toggle view — **Status** (`filter[status]`, opsi `CONTENT_STATUSES`, label `event:statusOptions.*`) + **Tipe Event** (param top-level `eventTypeId`, opsi dari `useEventTypes(can('event-type:read'))` → `.data?.items` `EventType[]`, label `type.name`). Sentinel `const ALL = 'ALL'` = "semua"; ubah filter → `setPage(1)`. State `statusFilter`/`eventTypeFilter` di page; `filter = useMemo(() => status ? { status } : {}, [status])`; `eventTypeId: eventTypeFilter || undefined`. Query key `useEvents` menyertakan keduanya.
- **Kolom `searchable` backend**: `name`, `slug`.
- **Kolom tampil + SortableHeader**: hanya kolom yang didukung whitelist `EVENT_SORT_FIELDS` backend (`name`, `slug`, `status`, `visibility`, `publishedAt`, `createdAt`, `updatedAt`). Yang tersedia di tabel: `name`, `status`, `visibility`, `publishedAt`. Klik cycle `asc → desc → null` via `nextSort`; ubah sort → `setPage(1)`.
- **Kolom non-sortable** (bukan whitelist `sortBy` backend, dirender `<TableHead>` biasa tanpa `SortableHeader`): `thumbnail`, `eventTypes`, `dates`, `location`. Menekan header ini tidak memicu 422 `assertAllowedSort`.
- **Pagination** (`DataTablePagination`): `Total N Event · halaman P`, server-side.
- **Query key**: `['event', { page, limit, search, sortBy, sortOrder }]`, `placeholderData: keepPreviousData`.
- **Toast CUD** di call-site page: sukses `event:toast.*`; gagal non-422 `toastError(getApiErrorMessage(...))`; 422 early-return (`isValidationError`) → per-field.
- Contoh query: `/events?page=1&limit=10&search=gamelan&sortBy=publishedAt&sortOrder=desc&filter[status]=PUBLISHED&eventTypeId=<uuid>`.
- **Baris kredit kartu** (`event-card.tsx`): **satu** baris ikon `Building2` + `getEventCreditName(event) ?? '—'`. Precedence kredit: `event.network?.name` (organizer) → `event.authors.map(a => a.fullName).join(', ')` → `event.creator?.fullName` (createdBy); `null` bila semua kosong. Logika terpusat di `features/event/lib/format.ts:getEventCreditName` (string kosong/whitespace dianggap absen). Ikon tetap `Building2` (tanpa ikon `User` terpisah); nilai murni data (tanpa key i18n baru).

## 6. Editor (`/events/new` & `/events/:id/edit`)

Satu komponen `EventForm` dipakai ulang; container memuat data (`useEvent(id)`) dan menyerahkan `initialValues`. Layout identik story: grid 70/30 (editor konten + panel settings), toggle settings, **tombol aksi** di header settings **dan** toolbar saat settings disembunyikan:
- **Simpan** (`runSubmit('save')`, outline, **selalu**) — label `event:form.saveAsDraft` saat `status === 'DRAFT'`, selain itu `event:form.save`.
- **Simpan sebagai Draft** (outline, `requestStatusChange('draft', …)`) — tampil bila `status === 'PUBLISHED'` **atau** (`canPublishEvent` **dan** `status === 'APPROVED'`) (kembalikan ke draft; editor non-admin dengan `event:update` juga melihatnya pada PUBLISHED).
- **Terbitkan** (primary, `openPublishDialog('publish')` → `PublishScheduleDialog` → `runSubmit('publish', publishedAt)`) — bila `canPublishEvent` **dan** `status !== 'REQUEST'` (mencakup DRAFT/APPROVED/PUBLISHED).
- **Ajukan untuk Terbit** (primary, `requestStatusChange('request', …)`) — **hanya event**, bila `canSubmitEvent` **dan** `status === 'DRAFT'` **dan** `!canPublishEvent`.

Tidak ada dua tombol primary bersamaan (Terbitkan vs Ajukan saling eksklusif lewat `canPublishEvent`); semua `disabled={isPending}`. Referensi: PUBLISHED/APPROVED (admin) = Simpan + Simpan sebagai Draft + Terbitkan; PUBLISHED (non-admin, `event:update`) = Simpan + Simpan sebagai Draft (tanpa Terbitkan); DRAFT (admin) = Simpan + Terbitkan; DRAFT (member) = Simpan + Ajukan; REQUEST = Simpan + banner. Banner `status === 'REQUEST'`: **Setujui** hanya bila `canApproveEvent` (`event:approve`, `openPublishDialog('approve')` → `PublishScheduleDialog` → `runSubmit('approve', publishedAt)` → `POST /events/:id/approve`), **Tolak** hanya bila `canRejectEvent` (`event:reject`, `requestStatusChange('reject', …)` → `POST /events/:id/reject`), selain itu hanya teks menunggu tanpa tombol. Aksi draft/request/tolak lewat `AlertDialog` konfirmasi (validasi `form.trigger()` dulu).

**Alur terbit/approve (shared)**: tombol Terbitkan & Setujui sama-sama membuka `components/shared/publish-schedule-dialog.tsx` — langkah 1 `Dialog` + `components/shared/date-time-picker.tsx` (`publishedAt`, ISO; tombol "Lanjut" nonaktif bila kosong/`isPending`), langkah 2 `AlertDialog` konfirmasi; konfirmasi → `onConfirm(publishedAt)`. Perbedaan aksi: `publishAction === 'publish'` → `runSubmit('publish', …)` (`status = PUBLISHED`); `publishAction === 'approve'` → `runSubmit('approve', …)` (`status` tetap `REQUEST`, `publishedAt` diteruskan ke route). State lokal `publishAt` dihapus dari form (nilai dipegang dialog, prefilled dari `initialPublishedAt ?? now`). `APPROVED` **deprecated** (tidak lagi jadi state antara; baris legacy tetap dirender).

**Kirim ke API (action-aware)**: `onSubmit(payload, action)` diteruskan ke route. Route menyimpan perubahan field dulu via `PATCH /events/:id` (`updateEvent`/`useUpdateEvent`); untuk `action === 'approve'` field `publishedAt` **dibuang dari body PATCH** (kalau tidak, PATCH memaksa `PUBLISHED` → approve 409) lalu `POST /events/:id/approve { publishedAt }` (`useApproveEvent`). `action === 'reject'` → `POST /events/:id/reject` (`useRejectEvent`). `action === 'request'` tetap `POST /events/:id/submit` setelah PATCH. PATCH **tidak lagi** membawa approve/reject.

**Urutan field settings** (create & edit): `name → slug → visibility → entry → thumbnail → eventTypes → authors → organizer → eventDates → location`. Gallery & `categoryIds` **tidak ada** (bukan kolom event). Dialog Terbitkan (`publishedAt`) memakai `components/shared/date-time-picker.tsx` (butuh tanggal + jam); baris tanggal event memakai `components/shared/date-picker.tsx` (tanggal saja) + `time-picker.tsx`.

- `name`/`slug`: input teks; auto-slug saat create, berhenti setelah slug disentuh; 409 slug → per-field.
- `visibility`: `RadioGroup` shadcn (`RadioGroupItem`, bukan `Select`/input native) — opsi `PUBLIC`/`PRIVATE` dari `VISIBILITIES`, label `event:visibilityOptions.*`, default `PUBLIC`; ikut payload create/update. Tiap opsi dibungkus `FormItem`+`FormControl`+`FormLabel` (label aksesibel, navigasi keyboard via RadioGroup, `disabled` diteruskan).
- `entry`: `RadioGroup` shadcn (pola `visibility`) — opsi `FREE`/`TICKET` dari `EVENT_ENTRIES`, label `event:entryOptions.*`, default `FREE`; ikut payload create/update sebagai `entry`.
- `thumbnail`: `ThumbnailUpload` shared (upload `POST /images`, preview, hapus, dropzone).
- `eventTypes`: `EventTypeCombobox` multi-select + tambah inline (`POST /event-types`); gate `event-type:create`. **Hapus tipe dari combobox** (gate `event-type:delete`, UX sama dengan hapus author): tiap `CommandItem` menampilkan tombol `Trash2` (`ml-auto`, `variant="ghost" size="icon"`, `stopPropagation`, `aria-label`/`title` `event:deleteEventType.optionLabel`) bila `canDeleteOption` true (predikat `canDeleteEventType && !eventTypeIds.includes(id)`); klik → `EventTypeDeleteDialog` (`AlertDialog`, `event:deleteEventType.title/description`) → `useDeleteEventType` (`DELETE /event-types/:id`, invalidate `['event-types']`) → buang id dari `eventTypeIds` + `event:toast.eventTypeDeleted`; gagal non-422 `event:toast.eventTypeDeleteFailed`.
- `organizer` (`networkId`): di-render tepat setelah authors bila `canReadNetworks` (`network:read`). `SearchSelect` single-select (shared, generic) — opsi `'' = Tanpa penyelenggara` + daftar network dari `GET /networks` (`useNetworks`, page 1 limit 100, `enabled: canReadNetworks`); memilih `''` mengirim `networkId: null` (clear relasi). Tombol `Plus` (bila `canCreateNetwork`) membuka `NetworkCreateDialog` (`features/network/components/`) dengan judul/deskripsi di-override (`event:form.organizerCreateTitle`/`organizerCreateDescription`); network yang baru dibuat langsung disisipkan ke opsi (dedupe by id) tanpa menunggu refetch. `networkId` **selalu** ikut payload submit (backend: `null` = clear saat edit, diabaikan saat create).
- `eventDates`: `EventDatesField` — tiap baris header `Day N` + tombol hapus, `DatePicker` (tanggal saja `"YYYY-MM-DD"`, satu baris penuh) + `TimePicker` (jam mulai & selesai, opsional, grid 2 kolom); tambah/hapus baris menambah/menghapusnya; nilai tanggal date-only, jam `"HH:mm"` ('' bila kosong).
- `location`: `EventLocationField` → **Venue** (`location.name`, wajib, label `event:location.venueLabel`), cascade **Country → State → City** (`SearchSelect` shared; country dari `useCountries`, state dari `useStates(iso2)` — `iso2` diturunkan dari country terpilih, city dari `useCities({ countryId, stateId })`; ganti country reset state+city, ganti state reset city, city disabled sampai state dipilih), `address` (opsional), dan **`mapsUrl`** (input teks `Input` + `FormField`, label `event:location.mapsUrlLabel`, placeholder `event:location.mapsUrlPlaceholder`) tempat user menempel tautan Google Maps; backend me-resolve `mapsUrl` → `lat`/`lng`/`embedUrl` (form **tidak** mengirim `lat`/`lng` lagi). Nilai form geo disimpan sebagai ID (string) — pilihan paling sedikit friksi (endpoint `/cities` & payload event butuh ID numerik).
- Validasi RHF + zod (`createEventSchema`), pesan dari `t('validation:*')`; 422/409 dipetakan per-field via `mapApiFieldErrors`; banner hanya non-422.

## 6a. Detail (`/events/:id`)

Halaman read-only full-bleed (tanpa sidebar/header). Container `app/routes/event-detail.tsx` (gate `can('event:read')`, `useEvent(id, canRead)`, tombol back melayang, skeleton/error/forbidden/not-found) → presentational `features/event/components/event-detail.tsx`.

- **Hero**: `aspect-[21/9] object-cover` + overlay gelap; fallback tanpa thumbnail memakai gradient token (`from-primary`). Badge `eventTypes` + status (`STATUS_VARIANT`) + visibility (`VISIBILITY_VARIANT`) di atas `<h1>` (`text-4xl md:text-5xl`); baris kredit + `publishedAt`. Kredit memakai `getEventCreditName(event) ?? t('event:detail.creatorFallback')` dengan **precedence sama seperti kartu** (organizer `network` → authors → createdBy), ikon `Building2`; fallback terakhir i18n, bukan `'—'`.
- **Body**: grid `lg:grid-cols-3` — konten HTML (2/3, `dangerouslySetInnerHTML` + `sanitizeHtml`, `CONTENT_CLASS` meniru story-detail) + aside (1/3) berisi `EventInfoCard`.
- **`EventInfoCard`**: box **"Event Details"** (`event:detail.detailsTitle`) — baris `LABEL — value` (label uppercase muted, value medium): DATE + TIME per `EventDate` (`DATE` = `formatDate(date, undefined, { day:'numeric', month:'long', year:'numeric' })` → "12 October 2026"; `TIME` = `start–end` / start saja / `—`), LOCATION (= `city?.name, country?.name`, state tidak ditampilkan, kosong dibuang), VENUE (`location.name`), TYPE (`eventTypes` nama digabung `', '`), ENTRY (`entry` → `event:entryOptions.*`). Pertahankan alamat + tombol "Buka di Maps" + "Salin alamat" + peta read-only (`EventLocationMap`). Baris hilang bila nilainya kosong. Props baru: `eventTypes: EventType[]`, `entry: EventEntry`.
- **`EventLocationMap`**: read-only Leaflet — `dragging/scrollWheelZoom/doubleClickZoom/boxZoom/keyboard/touchZoom/zoomControl` false + `Marker interactive={false}`; hanya render bila lat/lng `number` valid. Berorientasi tampilan saja agar detail tidak menarik logika editor.
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
| Aksi hapus tipe event (`DELETE /event-types/:id`) | `event-type:delete` |
| `POST /cities` (tambah kota inline) | `city:create` |
| Field Penyelenggara → `GET /networks` (opsi) | `network:read` |
| Tombol Tambah Penyelenggara → `POST /networks` (dialog) | `network:create` |
| Tombol Terbitkan / `runSubmit('publish')` (`status` → `PUBLISHED`) | `event:publish` |
| Tombol Ajukan untuk Terbit / `POST /events/:id/submit` | `event:submit` |
| Banner Setujui → simpan PATCH dulu, lalu `POST /events/:id/approve` body `{ publishedAt }` (`useApproveEvent`) | `event:approve` |
| Banner Tolak → simpan PATCH dulu, lalu `POST /events/:id/reject` (`useRejectEvent`) | `event:reject` |
| Menu sidebar Event | `event:read` |

## 8. i18n

- Namespace baru `event`: `src/i18n/locales/{en,id}/event.json`, didaftarkan di `src/i18n/index.ts`.
- `dashboard:nav.event` ditambahkan di `{en,id}/dashboard.json`.
- Validasi baru di namespace `validation`: `eventNameRequired`, `eventNameMax`, `eventSlugMax`, `eventSlugPattern`, `eventLocationRequired`, `eventLocationMax`, `eventAddressMax`, `eventMapsUrlMax`, `eventMapsUrlInvalid`.
- `event:location.*` kini hanya `title`, `venueLabel`/`venuePlaceholder` (dulu `nameLabel`/`namePlaceholder` — kini label **Venue**), `countryLabel`/`countryPlaceholder`/`countrySearch`/`countryEmpty`, `stateLabel`/`statePlaceholder`/`stateSearch`/`stateEmpty`/`stateSelectCountry`, `cityLabel`/`cityPlaceholder`/`citySearch`/`cityEmpty`/`citySelectState`, `addressLabel`, `addressPlaceholder`, `mapsUrlLabel`/`mapsUrlPlaceholder` (dulu `mapLabel` — dihapus bersama blok peta editor). Namespace `location` (`{en,id}/location.json`) dan `LocationMapPicker` telah **dihapus** — form lokasi memakai tautan `mapsUrl` (tanpa peta editor).
- `event:entryOptions.{FREE,TICKET}` + `event:form.entry` untuk kontrol ENTRY (en "Free"/"Ticket"; id "Gratis"/"Tiket").
- `event:form.startTime`/`event:form.endTime`/`event:form.timePlaceholder` untuk label & placeholder jam pada `EventDatesField`.
- `event:location.citySearchCreate`, `event:location.cityAdd`, `event:location.cityCreating` untuk baris tambah kota inline (`CitySelect`); `event:errors.createCityFailed` untuk toast gagal create kota non-422.
- `event:form.organizer*` (en/id): `organizer`, `organizerPlaceholder`, `organizerSearch`, `organizerEmpty`, `organizerNone`, `organizerAdd`, `organizerCreateTitle`, `organizerCreateDescription` — label & UI field **Penyelenggara** (organizer). `network:form.createDescription` ditambahkan untuk default deskripsi `NetworkCreateDialog`.
- `event:form.visibility` + `event:visibilityOptions.{PUBLIC,PRIVATE}` + `event:table.visibility` untuk kontrol & badge visibilitas. Label `PRIVATE` = **"Khusus Member"** (id) / **"Members Only"** (en) — bukan "Privat/Private"; enum API tetap `PRIVATE`.
- `event:detail.*` (en/id): `back`, `notFound`, `creatorFallback`, `noContent`, `detailsTitle`, `date`, `time`, `venue`, `type`, `entry`, `dates`, `location`, `openInMaps`, `copyAddress`, `addressCopied`, `addressCopyFailed`, `mapAlt`.
- `event:deleteEventType.{title,description,optionLabel}` (en/id): dialog konfirmasi + label tombol hapus tipe event di combobox.
- `event:toast.eventTypeDeleted` / `event:toast.eventTypeDeleteFailed`: toast sukses/gagal hapus tipe event (non-422).
- `event:filter.{status,allStatuses,eventType,allEventTypes}` (en/id): label & opsi sentinel filter status + tipe event pada list `/events`.

## 9. Verifikasi

- `pnpm lint` → **0 error**, 8 warning pre-existing (shadcn `react-refresh`, `auth-provider`, React Compiler `RegisterForm`/`profile-card`), tanpa warning baru. (Dokumen lama menyebut 7; hitungan aktual 8.)
- `pnpm exec tsc -b --noEmit` → **EXIT=0**, 0 error (5 error TS2322 billing sudah teratasi; file `event-detail*`/`event-info-card`/`event-location-map` sendiri 0 error).
- `pnpm build` (`tsc -b && vite build`) → **sukses** (EXIT=0); hanya peringatan ukuran chunk Vite (unrelated).

## 10. Catatan

- `status` ikut pada payload create/update (mengikuti alur workflow story); kontrak brief tidak menyebut eksplisit — samakan dengan `posts`.
- Event **tidak punya** `imageIds`/gallery di payload; gambar inline editor tetap diupload tapi tidak di-bind ke event (hanya URL di `content`).
- Komponen `rich-text-editor`/`thumbnail-upload` dipromosikan ke `components/shared/` (dipakai story + event); label editor masih memakai namespace `story:editor.*` (teks identik) — calon perbaikan: parameterisasi namespace bila label perlu dibedakan.
- E2E menunggu backend modul `event`/`event-type` siap.
- **Iterasi visibilitas**: field `visibility` (`PUBLIC`/`PRIVATE`, default `PUBLIC`) ditambahkan ke `Event`/`CreateEventInput`, zod schema, form (`RadioGroup` shadcn), tabel (kolom badge `VISIBILITY_VARIANT` + `SortableHeader` field `visibility`), dan i18n (`en`/`id`). Sort server-side via `sortBy=visibility`; wiring generik page/api/hook meneruskan `sortBy`/`sortOrder` tanpa perubahan.
- **Iterasi tanggal date-only**: baris tanggal event jadi tanggal saja (`"YYYY-MM-DD"`) via `components/shared/date-picker.tsx`; jam tetap di `TimePicker` terpisah. Backend `EventDateDto.date` (`@IsISO8601()`) menerima `"YYYY-MM-DD"`, menyimpan UTC midnight, dan mengembalikan ISO datetime — FE mengubahnya balik ke date-only lewat `toDateOnly` (`features/event/lib/format.ts`, baca komponen UTC) di `event-edit.tsx:toFormValues`. Submit `event-form.tsx` mengirim `date` apa adanya `"YYYY-MM-DD"` dan tetap drop `startTime`/`endTime` kosong (edit boleh `dates: []`). `formatEventDate` membangun Date lokal tengah hari dari bagian `"YYYY-MM-DD"` agar hari tidak bergeser timezone. `schema.ts` tetap `date: z.string()`.
- **Iterasi badge card**: badge status dipindah dari `CardContent` ke **overlay pojok kiri-atas thumbnail** (`absolute left-2 top-2 z-10`, `shadow-sm`) di `event-card.tsx`; badge `memberOnly` (`variant="secondary"`, `shadow-sm`) muncul bila `visibility === 'PRIVATE'`. Key i18n baru `event:card.memberOnly` (`Khusus Member`/`Members Only`). Blok tanggal (`CalendarDays` + daftar) kini langsung sebagai child `CardContent` (pembungkus `flex items-start justify-between` + badge dihapus). `VISIBILITY_VARIANT` tidak diimpor di card (hanya `STATUS_VARIANT`). Tanpa perubahan query/payload.
- **Iterasi grid card responsif**: string grid tetap `gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` di `event-card.tsx` + `EventsCardSkeleton` diganti `CARD_GRID_CLASS` dari `components/shared/card-grid.ts` (`grid gap-4 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]`) — jumlah kolom mengikuti lebar layar native (CSS Grid `auto-fill`), konstanta sama dipakai modul story. Tanpa JS, tanpa dependency baru; `auto-fill` (bukan `auto-fit`) menjaga lebar kartu saat item sedikit.
- **Iterasi aksi card**: aksi `event-card.tsx` diganti dari `DropdownMenu`/`CardAction` (`MoreHorizontal`) menjadi dua `Button` eksplisit di **bawah `CardContent`** (`<div className="relative z-20 mt-auto grid grid-cols-1 gap-2 sm:grid-cols-2">`): **Edit** (`variant="outline"`, `Pencil`, gate `canUpdate`) + **Hapus** (`variant="destructive"`, `Trash2`, gate `canDelete`), dirender bila `showActions = canUpdate || canDelete` — pola sama `story-card.tsx`. `relative z-20` wajib agar klik tombol tidak tertelan overlay `<Link absolute inset-0 z-10>` (thumbnail/judul/navigasi kartu tetap). Agar tombol selalu rata bawah di tiap kartu (tinggi konten bervariasi), `Card` memakai `h-full flex flex-col`, `CardContent` `flex-1`, dan baris aksi `mt-auto`. Field visibilitas di `event-meta-panel.tsx` juga diganti `Select` → `RadioGroup` (`RadioGroupItem`, dengan `aria-label` pada grup).
- **Iterasi gate aksi workflow + endpoint submit**: tombol aksi `EventForm` jadi 2 `Button` berbasis permission (tanpa nama role) — lihat §6. `event-new.tsx`: bila `payload.status === 'REQUEST'` create dulu sebagai `DRAFT` lalu `submitEvent.mutateAsync(created.id)`; `event-edit.tsx`: setelah update, bila `payload.status === 'REQUEST'` dan `updated.status === 'DRAFT'` → `submitEvent.mutateAsync(id)`. `submissionError` hanya dari `create/updateEvent.error` (error `submitEvent` di-toast terpisah, tidak ke form — cegah 409 submit salah jadi error `slug`); create + submit gagal → navigate `/events/:id/edit` agar tidak submit ulang/duplikat. `isPending` gabungan. Komponen tetap presentational (props boolean `canPublishEvent/canSubmitEvent/canApproveEvent/canRejectEvent`).
- **Iterasi creator card**: kartu tidak lagi menampilkan tanggal publish (`formatDateTime(event.publishedAt)` dihapus dari `CardContent`, import `formatDateTime` dibuang). Posisinya diganti baris creator/organiser (ikon `Building2` + teks, pola sama baris lokasi). Type `EventCreator { id, fullName, network: { id, name } | null }` + field `creator: EventCreator | null` ditambahkan di `types.ts` (kontrak API baru). Tanpa key i18n baru (nilai = data). Kolom `publishedAt` di `event-table.tsx` tetap.
- **Iterasi publish/approve + dialog shared**: `POST /events/:id/approve` menerima body `{ publishedAt }` dan menghasilkan `PUBLISHED` (bukan `APPROVED`); `approveEvent(id, publishedAt)` + `useApproveEvent` (`mutationFn ({ id, publishedAt })`) dipakai `dashboard-home.tsx` **dan** editor `event-edit.tsx`. Komponen baru `components/shared/publish-schedule-dialog.tsx` (Dialog pilih `publishedAt` → AlertDialog konfirmasi → `onConfirm`) menggantikan `Dialog` inline di `event-form.tsx`. `APPROVED` deprecated (baris legacy tetap dirender). Key i18n baru: `event:publishDialog.confirmDescription`. `docs/module/dashboard.md` §10b ikut diperbarui.
- **Iterasi aksi editor + label visibilitas**: blok `actions` `event-form.tsx` dirombak — **Simpan** selalu (label `saveAsDraft` saat `status === 'DRAFT'`), **Simpan sebagai Draft** bila `status === 'PUBLISHED' || (canPublishEvent && status === 'APPROVED')`, **Terbitkan** bila `canPublishEvent && status !== 'REQUEST'`, **Ajukan** hanya bila `canSubmitEvent && status === 'DRAFT' && !canPublishEvent`. Lihat §6. Label `visibilityOptions.PRIVATE` diganti "Privat"→"Khusus Member" / "Private"→"Members Only" (enum API tetap `PRIVATE`).
- **Iterasi endpoint transisi editor**: `EventFormProps.onSubmit` jadi `(payload, action: EventFormAction)`. Editor Setujui/Tolak tidak lagi lewat `PATCH status`; `event-edit.tsx` men-save field dulu (`PATCH`, `publishedAt` dibuang untuk approve) lalu `useApproveEvent`/`useRejectEvent` (`POST /events/:id/approve{ publishedAt }` / `POST /events/:id/reject`). `isPending` gabungan `updateEvent` + `submitEvent` + `approveEvent` + `rejectEvent`.
- **Iterasi `Event.network`** (opsional): backend menambah field `network` (relasi opsional ke `Network`) pada `Event`. **Tanpa breaking change** — field baru nullable. Tambahkan `network: { id: string; name: string } | null` ke interface `Event` di `features/event/types.ts` (di samping `creator` existing); `EventCreator` tidak berubah.
- **Iterasi kredit tunggal** (menggantikan dua baris creator + authors): kartu (`event-card.tsx`) & detail (`event-detail.tsx`) kini menampilkan **satu** baris kredit ikon `Building2` dengan precedence berantai **organizer (`event.network?.name`) → authors (`event.authors.map(a => a.fullName).join(', ')`) → createdBy (`event.creator?.fullName`)**; `null` bila semua kosong. Logika tunggal di `features/event/lib/format.ts:getEventCreditName(event)` (pakai `trim` + `||`, string kosong = absen); kartu fallback `'—'`, detail fallback `t('event:detail.creatorFallback')`. Ikon `User` & baris authors duplikat di kartu dihapus; key i18n tidak berubah.
- **Event `DRAFT` dari approve submission publik** (rencana — lihat `docs/module/event-submission.md` §6): saat admin **approve** usulan publik, backend me-recreate konten submission menjadi row `Event` berstatus **`DRAFT`** (`createdBy` = admin, `networkId` dari organiser submission). Event tsb **tampil di list `/events` internal** (permission `event:read`), **diedit di `/events/:id/edit`**, lalu **di-publish langsung** lewat alur publish existing (tombol **Terbitkan**, `event:publish` → `status=PUBLISHED`) — **tanpa** `event:submit`/`REQUEST` (bypass alur ajukan-terbit). Reject submission **tidak** membuat `Event`. Editor FE existing sudah menangani `DRAFT` (Simpan + Terbitkan untuk admin) — **tidak perlu** perubahan kode; catatan ini untuk konteks alur. Status **RENCANA** di sisi `event-submission`; modul `event` sendiri sudah diimplementasikan.
- **Iterasi ENTRY + geo relasi + box "Event Details"**: `Event.entry: EventEntry` (`FREE`/`TICKET`, konstanta `EVENT_ENTRIES`); form `RadioGroup` (default `FREE`); payload `entry`. `EventLocation` + `countryId/stateId/cityId` + relasi `country/state/city`; form cascade Country→State→City (`SearchSelect`) menyimpan **ID** (bukan nama seperti network) — sedikit friksi: tak perlu map nama→ID saat submit, `/cities` butuh ID numerik. Label `location.name` → **Venue**. `EventInfoCard` dirombak jadi box **Event Details** 6 baris (lihat §6a). `types.ts`, `lib/schema.ts`, `geo/api/geo.ts:listCitiesByCountry`, `geo/hooks/use-cities.ts`, `event-location-field.tsx`, `event-meta-panel.tsx`, `event-form.tsx`, `event-info-card.tsx`, `event-detail.tsx`, `app/routes/event-edit.tsx`, i18n `{en,id}/event.json`.

## 11. Dual View `/events` (Admin vs Non-Admin)

Dispatcher `EventsPage` (`app/routes/events.tsx`) memilih view **hanya dari permission** (tanpa nama role): `canAny(['event:approve', 'event:publish', 'event:reject', 'event:unpublish'])` via `useAuthPermissions()` — sepadan scope `all` backend (`access-scope.service.ts`); role org/member tidak memilikinya.

- **Admin** → `AdminEventsPage` (internal, JSX/behavior tidak berubah): toggle card/tabel, search, sort, pagination, dialog hapus.
- **Non-admin** → `OrgEventsPage` (`app/routes/events-org.tsx`): header dengan tombol "Tambah" (gate `event:create`) + dua seksi bertumpuk. Empty state tiap seksi juga menampilkan CTA "Tambah" bila `event:create`.
- Error ditangani **per-seksi** (tidak saling menyembunyikan): tiap section punya `isPending`/`errorMessage` sendiri; 403 → `event:errors.forbidden`, selain itu `event:errors.loadData`.

### Seksi 1 — "Event bulan ini"
- `EventMonthSection` (`features/event/components/event-month-section.tsx`), grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` gap 4.
- State bulan di container (default bulan berjalan, tanggal 1 lokal); tombol prev/next. Label bulan locale browser lewat `formatDate(month, undefined, { dateStyle: undefined, month: 'long', year: 'numeric' })` — tanpa formatter lokal baru.
- Kartu memakai **`EventHighlightCard` shared** (`@/components/shared/event-highlight-card`, juga dipakai dashboard non-admin — lihat `docs/module/dashboard.md` §10e): cover `aspect-[16/10]` + chip tanggal mengambang + overlay gradien. Props dipetakan dari `Event` (`date` = `event.dates[0]?.date ?? null`, `locationName` = `event.location?.name ?? null`, `eventTypes` = nama tipe). Klik kartu → `/events/{id}` (Link absolute). Skeleton mengikuti bentuk cover `aspect-[16/10]`. Empty state + CTA "Tambah" bila `event:create`.
- Tanpa prop `onView` (navigasi ditangani `Link` kartu).

### Seksi 2 — "My Event"
- `MyEventList` (`features/event/components/my-event-list.tsx`) — `Table` dengan kolom Date, Event Name (thumbnail + title), Location (name + address), Category (`eventTypes` badges), Status (`STATUS_VARIANT` + `event:statusOptions.*`), Actions.
- Kolom Date memakai `formatEventDateLines` (`lib/format.ts`): tiap `EventDate` dirender **tanggal dulu, lalu `<br/>`, lalu jam** (jam hilang → hanya tanggal, tanpa `<br/>`). Antar tanggal ditumpuk **vertikal** dalam `<div className="flex flex-col gap-2">` sehingga `gap-2` memberi jarak vertical antar hari (tanpa separator `<br />` antar entri). `formatEventDate` (tanggal + ` · ` + jam dalam satu string) dipakai `event-card`/`event-table` (kini delegasi ke `formatEventDateLines`); `event-month-section` tidak lagi memakainya (kartu highlight hanya butuh tanggal iso untuk chip).
- Actions: tombol "Detail" → `/events/{id}`, dropdown `MoreHorizontal`: Edit (`Pencil`, gate `event:update`) + Delete (`Trash2`, gate `event:delete`) — item disembunyikan bila gate false.
- Delete memakai `useDeleteEvent` + `AlertDialog` + pola toast yang sama dengan `events.tsx`.
- **Pagination**: `DataTablePagination` di bawah tabel — `limit: 10` (`MY_EVENT_LIMIT`), state `myEventPage` di container, `entityName` = `event:org.myTitle`; disembunyikan saat seksi error. `items` hanya berisi item halaman aktif.

### Sumber data, `mine` & `eventMonth`
- `GET /events` menerima `mine=true`: event seorganisasi bila user punya organisasi, selain itu hanya event milik user. Seksi "My Event" memakai `useEvents({ page, limit: 10, mine: true })` dengan **pagination server-side** (`DataTablePagination`, state `myEventPage`, clamp saat total menyusut setelah delete); seksi "Event bulan ini" tetap scoped tanpa `mine` dan tanpa pagination (limit 100). Tanpa endpoint "mine" baru.
- `GET /events` menerima `eventMonth=YYYY-MM` (backend paralel: event dengan ≥1 tanggal di bulan UTC tsb).
- `ListEventsParams` (`api/events.ts`) extends `ListParams` + `eventMonth?` + `mine?` (serialisasi `mine=true`); `useEvents` menerima keduanya, meneruskan ke `listEvents`, dan memasukkannya ke queryKey. `keepPreviousData` + `staleTime` tetap.
- Query: seksi bulan `useEvents({ page: 1, limit: 100, eventMonth })`; seksi list `useEvents({ page: myEventPage, limit: 10, mine: true })` (`MY_EVENT_LIMIT = 10`). Seksi bulan tetap ponytail tanpa pagination — tambah bila bisa >100.
- **Add author dari form**: field author (`UserCombobox`, `event-meta-panel`) punya tombol `Plus` (prop `canCreate`/`onCreateClick`, i18n `user:addAuthor`) yang membuka `AuthorCreateDialog`; author baru langsung masuk options (list + refetch `['users']`) **tanpa auto-dipilih** — admin memilih manual di `authorIds`. Admin (`user:delete` + `admin:access`) juga punya aksi hapus author di dropdown (`canDeleteOption`/`onDeleteOption` → `AuthorDeleteDialog`, `DELETE /users/:id?cascadeContent=true`) yang **ikut menghapus** semua story/event/archive milik author tsb — destruktif, tanpa undo. Lihat `user.md` §10–§11.
- **Field penyelenggara (`networkId`)**: field baru **Penyelenggara** (`event:form.organizer`) di `event-meta-panel.tsx`, tepat setelah authors, gated `network:read`. `SearchSelect` (shared, generic) dengan opsi `Tanpa penyelenggara` (`''`) + daftar `GET /networks` (`useNetworks`, `enabled: canReadNetworks`). Tombol `Plus` (gate `network:create`) membuka `NetworkCreateDialog` (`features/network/components/network-create-dialog.tsx`) — judul/deskripsi di-override (`event:form.organizerCreateTitle`/`organizerCreateDescription`), network dibuat langsung disisipkan ke opsi. `networkId` selalu ikut payload (`null` = clear saat edit). Lihat `network.md` §3 (komponen/`buildNetworkPayload`/`EMPTY_NETWORK_VALUES`).

### i18n (`event:org.*`, `en`/`id`)
`monthTitle`, `prevMonth`, `nextMonth`, `emptyMonth`, `myTitle` ("My Event" en/id), `emptyList`, `columnDate`, `columnEventName`, `columnCategory`, `detail`. Reuse: `event:add`, `event:table.location`, `event:table.status`, `event:table.edit`, `event:table.delete`, `event:errors.loadData`, `event:errors.forbidden`, `common:table.actions`, `common:table.actionsFor`, `event:statusOptions.*`, `event:delete.*`, `event:toast.*`. Kartu highlight memakai namespace **`common`**: `eventCard.{noThumbnail,noLocation,openEvent}` (key `event:org.viewEvent` **dihapus** — tombol diganti Link kartu).

