# Module: Network — Brief

Dokumen ini mencatat desain/implementasi halaman **Networks** pada frontend React — CRUD lengkap network (list paginated, create, update, delete). Mengikuti konvensi `frontend/AGENTS.md` dan format brief `docs/module/user.md`.

> **Catatan RBAC**: entitas UI/route/API memakai istilah **Network** (base path `/api/v1/networks`); permission ikut berganti menjadi **`network:create|read|update|delete`**. Role `organization` sudah **dihapus** dari seeder backend.

## 1. Tujuan & Ruang Lingkup

- Menyediakan **CRUD network** admin-only: lihat daftar (pagination), tambah, edit (nama/lokasi/koordinat + kontak/sosial media + konten rich HTML), hapus.
- Halaman create/edit berupa **full-page editor** dua kolom (rich text `content` di kiri, panel meta di kanan) — meniru pola editor Story, bukan lagi dialog.
- Konsumsi API `backend/` modul network, prefix global `/api/v1`, butuh JWT Bearer + permission `network:*`.

## 2. Routing

- Route didaftarkan di `src/app/routes/index.tsx`, child di bawah `/` protected (`DashboardLayout`).
- Route **list** `/networks` dibungkus `<RequirePermission code="network:read">`; route **create/edit** menggate permission (`network:create`/`network:update`) di **dalam komponen** (bukan `RequirePermission`).
- **Sidebar disembunyikan pada route editor**: `AppShell` (`features/dashboard/components/app-shell.tsx`) mendeteksi `isNetworkEditor` (`pathname === '/networks/new' || /^\/networks\/[^/]+\/edit$/`) dan merender branch khusus **tanpa** sidebar — header ringkas berisi breadcrumb **Dashboard / Networks / <judul>** + `LanguageSwitcher` + `ThemeToggle`, lalu `<main>` berisi `<Outlet/>`. Deteksi murni `pathname`.

```
/networks            → list (tabel)      — RequirePermission code="network:read"
/networks/new        → editor create      — gate network:create di komponen
/networks/:id/edit   → editor edit        — gate network:update di komponen
```

## 3. Struktur File

```
src/app/routes/
├── networks.tsx                          # list: state page/search/sort, mutation, dialog hapus
├── network-new.tsx                       # editor create (container, gate network:create)
└── network-edit.tsx                      # editor edit (load detail, gate network:update)

src/features/network/
├── types.ts                              # Network, NetworkSocialMedia, Create/UpdateNetworkInput
├── api/
│   └── networks.ts                       # listNetworks, getNetwork, create/update/delete
├── lib/
│   ├── constants.ts                      # ORGANISATION_TYPES, ACTIVITY_TYPE_OTHER, ACTIVITY_TYPE_OPTIONS (dimiliki network; submission re-export)
│   ├── schema.ts                         # createNetworkSchema + NetworkFormValues + EMPTY_NETWORK_VALUES
│   └── payload.ts                        # buildNetworkPayload (dipakai form full-page & dialog create)
├── hooks/
│   ├── use-networks.ts                   # query ['network', {page,limit,search,sortBy,sortOrder,filter}]
│   ├── use-network.ts                    # query ['network', {id}] (detail edit, staleTime 30s)
│   ├── use-create-network.ts             # invalidate ['network']
│   ├── use-update-network.ts             # invalidate ['network'] + ['network', {id}]
│   ├── use-approve-network.ts            # mutationFn({id, publishedAt?}) → POST /networks/:id/approve (REQUEST atau DRAFT → PUBLISHED)
│   ├── use-reject-network.ts             # mutationFn(id) → POST /networks/:id/reject
│   ├── use-submit-network.ts             # mutationFn(id) → POST /networks/:id/submit (DRAFT→REQUEST)
│   ├── use-unpublish-network.ts          # mutationFn(id) → POST /networks/:id/unpublish (PUBLISHED→DRAFT)
│   ├── use-delete-network.ts
│   └── use-bulk-update-network-status.ts         # POST /networks/bulk-status
└── components/
    ├── network-table.tsx                 # presentational + DropdownMenu Edit/Delete + Submit/Publish/Unpublish
    ├── network-form.tsx                  # form editor full-page (RHF + zod, 2 kolom)
    ├── network-meta-panel.tsx            # panel kanan: name/organisationType/ledBy/country/state/address/mapsUrl/website/contact/socialMedia/activityType
    ├── network-create-dialog.tsx         # Dialog create reusable (NetworkMetaPanel + buildNetworkPayload, mirip AuthorCreateDialog)
    └── delete-network-dialog.tsx         # AlertDialog konfirmasi hapus
```

Komponen shared reusable: `src/components/shared/search-select.tsx` — single-select searchable combobox (`Popover` + `Command`, role `combobox`, centang item terpilih); `src/components/shared/creatable-select.tsx` — varian dengan tambah inline (baris "Add \"{{name}}\"" saat nama belum ada, `canCreate` + `onCreate(name)` → opsi hasil create di-merge lokal, tanpa refetch gate). Keduanya presentational (opsi + label via props).

Data referensi geo berasal dari fitur bersama **`src/features/geo/`**: `features/geo/api/geo.ts` (`listCountries`, `listStatesByCountry`, `listCitiesByCountry`, `createState`, `createCity` — paginasi loop limit 100), `features/geo/hooks/use-countries.ts` (query `['geo','countries']`, staleTime 24h), `features/geo/hooks/use-states.ts` (query `['geo','states', iso2]`, staleTime 1h), `features/geo/hooks/use-cities.ts`, `features/geo/hooks/use-create-state.ts` (invalidate `['geo','states']`), `features/geo/hooks/use-create-city.ts` (invalidate `['geo','cities']`). Editor network **tidak lagi** menyimpan `api/geo.ts`/`use-countries.ts`/`use-states.ts` di folder fitur sendiri. Editor konten memakai `src/components/shared/rich-text-editor.tsx` (shared, dipakai juga story/event).

## 4. Komponen yang Ditambah (via CLI)

Tidak ada komponen `components/ui/` baru — memakai `table`, `alert-dialog`, `button`, `dropdown-menu`, `form`, `input`, `skeleton` yang sudah ada (plus komponen shared `search-select`/`rich-text-editor`, dan `useFieldArray` react-hook-form untuk daftar sosial media). Larang edit manual `src/components/ui/`.

## 5. Kontrak API

Envelope: sukses `{ data, message }`; list `{ data, meta:{page,limit,total}, message }`; error `{ statusCode, message, errors }`.

| Endpoint | Body | Keterangan |
| --- | --- | --- |
| `POST /networks` | `{ name, state?, country?, address?, mapsUrl?, website?, contact?, socialMedia?, content?, submitterEmail? }` | `name` wajib max200; `mapsUrl?` URL http(s) max2048 (nilai non-http(s) → 422); `website?` max500; `contact?` max200; `socialMedia?` maks 10 entri `{ platform(1..50), url(1..500) }`; `content?` rich HTML max100000 (disanitasi backend). `submitterEmail?` email max200, nullable — satu-satunya field audit submitter. **Lokasi**: server menurunkan `lat`/`lng` + `embedUrl` dari `mapsUrl` (link Google Maps); tautan tak terurai/invalid → 422 per-field `mapsUrl`. |
| `GET /networks?page=&limit=` | — | list paginated. |
| `GET /networks?search=&sortBy=&sortOrder=` | — | search OR like `name,state,country,address`; <2 char diabaikan; `sortBy=state` didukung. |
| `GET /networks?filter[status]=REQUEST` | — | filter generik `filter[<key>]=<value>` (mis. `status=REQUEST`, `source=PUBLIC`). Menampilkan **usulan submission publik** (`status=REQUEST`, `source=PUBLIC`). |
| `GET /networks/:id` | — | detail (dipakai editor edit; termasuk `content`). |
| `PATCH /networks/:id` | field opsional | body kosong = tanpa perubahan. |
| `DELETE /networks/:id` | — | hapus; relasi user/billing `SetNull`. |
| `POST /networks/:id/approve` | `{ publishedAt? }` | permission **`network:approve`**; body opsional (ISO 8601) → `status=PUBLISHED` (`publishedAt`/`approvedAt` terisi). Sumber boleh `REQUEST` **atau** `DRAFT` (approver menerbitkan langsung tanpa submit). |
| `POST /networks/:id/reject` | — | permission **`network:reject`**; `status=DRAFT`. |
| `POST /networks/:id/submit` | — | permission **`network:update`**; `status=DRAFT` → `REQUEST`. |
| `POST /networks/:id/unpublish` | — | permission **`network:unpublish`**; `status=PUBLISHED` → `DRAFT`. |

`buildNetworkPayload` (`lib/payload.ts`; dipakai `network-form.tsx` **dan** `network-create-dialog.tsx`, satu implementasi) mengirim field opsional kosong sebagai **`null` eksplisit** (bukan di-omit): `state`/`country`/`address`/`mapsUrl`/`website`/`contact`/`content` → `null` saat kosong. `submitterEmail` juga dikirim `null` saat kosong (trim dulu). `socialMedia` → array entri terisi, atau `null` bila tak ada entri (baris platform/url kosong **di-strip sebelum submit**). Backend memetakan `null` → clear. FE **tidak** mengirim `lat`/`lng` — server menurunkannya dari `mapsUrl`.

NetworkEntity: `{ id, name, state|null, country|null, cityId|null, city|null, address|null, website|null, contact|null, socialMedia|null, content|null, lat|null, lng|null, embedUrl|null, submitterEmail|null, createdAt, updatedAt }` (`city` = `{ id, name } | null` dari `networkSelect`; `content` = rich HTML; `state` menggantikan `city` lama; `socialMedia` = `{ platform, url }[] | null`; `lat`/`lng`/`embedUrl` = hasil resolusi server dari `mapsUrl`; baris hanya menyimpan `submitterEmail` sebagai audit — tanpa nama/negara/state pengirim).

**Kolom submission/review (baru)**: baris `GET /networks` juga membawa `status` (`DRAFT|REQUEST|APPROVED|PUBLISHED`, tipe FE `NetworkStatus`), `source` (`PUBLIC|REGISTERED`), `publishedAt|null`, `approvedAt|null`, `organisationType|null` (`GAMELAN_GROUP|ASSOCIATION|INSTITUTION`), `ledBy|null`, `mapsUrl|null`, `activityType|null`, `countryId|null`, `stateId|null`, `createdBy|null`. Submission publik (`POST /network-submissions` — lihat `docs/module/network-submission.md`) menulis langsung ke tabel ini dengan `status=REQUEST` + `source=PUBLIC`; usulan tampil sebagai baris list (filter `filter[status]=REQUEST`) dan direview lewat editor `/networks/:id/edit` + aksi `POST /networks/:id/approve|reject`.

### Data referensi geo (PUBLIC)

| Endpoint | Keterangan |
| --- | --- |
| `GET /countries?page=&limit=&sortBy=name&sortOrder=asc` | item `{ id:number, name:string, iso2:string, ... }`. `listCountries` loop paginasi (limit 100). |
| `GET /states?filter[countryCode]=<ISO2>&page=&limit=&sortBy=name&sortOrder=asc` | item `{ id:number, name:string, countryCode:string, ... }`. `listStatesByCountry(iso2)` loop paginasi. |
| `POST /states` | body `{ name, countryId }` → `{ id, name, countryCode }`; permission **`state:create`**; idempotent (nama sama case-insensitive + countryId sama → existing, bukan 409). |
| `POST /cities` | body `{ name, countryId, stateId }` → `{ id, name, countryId }`; permission **`city:create`**; idempotent. |

Field form `country` & `state` menyimpan **nama** (value=label=name). `iso2` diturunkan dari nama country terpilih (`countries.find(c => c.name === country)?.iso2`). Endpoint publik — kegagalan load tidak memblokir submit.

### Searchable / Sortable

- **Searchable**: `name`, `state`, `country`, `address`. Placeholder: "Cari nama, negara bagian, negara, atau alamat...".
- **Sortable** (semua kolom tampil): `name`, `ledBy`, `city` (urut nama kota via relasi `city.name`), `country`, `status`, `createdAt` (+ `state`, `address`, `updatedAt` didukung backend).
- Kolom tabel: Nama → Dipimpin oleh → Kota → Negara → Status → Dibuat → Aksi. Dipimpin oleh tampil `ledBy` (`—` bila null); Kota tampil `city.name` (`—` bila null); Status tampil `Badge` (variant: DRAFT `secondary`, REQUEST `outline`, APPROVED/PUBLISHED `default`) dengan label `network:statusOptions.<STATUS>`. Kolom **Negara Bagian** tidak lagi ditampilkan di list (`state` tetap ada di form/detail).
- Contoh query: `GET /api/v1/networks?page=1&limit=10&search=gamelan&sortBy=ledBy&sortOrder=asc`.
- **Filter status** (list): `Select` di samping search bar (`network:filter.status` / `network:filter.allStatuses`), opsi dari `NETWORK_STATUSES` (`features/network/types.ts`), label `network:statusOptions.<STATUS>`. Nilai kosong = semua status; pilih status → `setPage(1)` dan kirim `filter: { status }` ke `useNetworks` (query key ikut berubah). Contoh: `GET /api/v1/networks?page=1&limit=10&filter[status]=REQUEST`.

## 6. Konvensi (AGENTS.md)

- Query key `['network', { page, limit, search, sortBy, sortOrder, filter }]`, `placeholderData: keepPreviousData`, `staleTime: 30_000`.
- Search debounce 400ms (`useDebouncedValue`); ubah search/sort → `setPage(1)`; halaman di luar jangkauan di-clamp.
- Form **RHF + zod**, schema `useMemo(..., [t])`, pesan dari `t('validation:*')`.
- **Sosial media dinamis**: `socialMedia` dikelola via `useFieldArray` react-hook-form (platform + url per baris, tombol tambah/hapus, maks 10 entri). Baris dengan platform **dan** url kosong di-strip di `buildPayload`; baris terisi wajib lengkap (superRefine zod → pesan per-field via `<FormMessage />`).
- **Country/state/city via combobox**: field `country` memakai `SearchSelect`; `state` dan `city` memakai `CreatableSelect` (`components/shared/creatable-select.tsx`) — tambah inline saat nama belum ada. Opsi country dari `useCountries` (staleTime 24h), opsi state dari `useStates(iso2)` (staleTime 1h, `enabled` bila `iso2` ada), opsi city dari `useCities({ countryId, stateId })`. `iso2` = `countries.find(c => c.name === countryValue)?.iso2`. State select `disabled` bila country belum dipilih / query pending; city select `disabled` bila state belum dipilih. Ganti country → `form.setValue('state', '', { shouldDirty, shouldValidate })` (nama state tidak berlaku lintas negara) + reset `cityId`; ganti state → reset `cityId`.
- **Tambah inline state/city**: `CreatableSelect` menampilkan baris `Add "{{name}}"` (i18n `network:form.stateAdd`/`cityAdd`, placeholder `stateSearchCreate`/`citySearchCreate`, label proses `stateCreating`/`cityCreating`) bila `canCreate` dan nama belum ada. Wiring di `network-meta-panel.tsx` (pemilik query geo): `state:create` → `useCreateState` → `POST /states` (`{ name, countryId: Number(countryIdValue) }`); `city:create` → `useCreateCity` → `POST /cities` (`{ name, countryId, stateId }`); hasil dipetakan ke `{ value: String(id), label: name }` lalu di-merge lokal oleh komponen (select langsung terisi, tidak menunggu refetch `['geo','states'|'cities']`). Gagal: 422 early-return (tanpa toast), non-422 → `toastError(getApiErrorMessage(..., t('network:errors.createStateFailed'|'createCityFailed')))`.
- **Layout editor full-page** (`network-form.tsx`, meniru `story-form.tsx`): grid **70/30 tanpa gap** (`lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]`) — kolom kiri `RichTextEditor` (shared) untuk field `content`, kolom kanan kartu panel meta (`network-meta-panel.tsx`). Panel kanan bisa disembunyikan/ditampilkan via state `showSettings`: tombol `PanelRightClose` (header kartu) menyembunyikan, `PanelRightOpen` (`absolute right-2 top-2 z-10`) menampilkan; saat tersembunyi grid jadi 1 kolom penuh dan tombol **Simpan** tetap tampil di kanan-atas. Full-height desktop (`lg:h-svh lg:overflow-hidden` di `AppShell` → `lg:min-h-0` di route/form/grid); mobile scroll normal. Kartu tanpa `rounded`/`shadow`, pemisah hanya border.
- **Field panel meta** (`network-meta-panel.tsx`, urutan): `name` (Input) → `organisationType` (Select) → `ledBy` (Input) → section **`Submitted by`** (`network:form.submitter.title`, dipisah `border-t pt-4`; hanya saat prop `showSubmitter` = true, default true): **hanya** `submitterEmail` (Input email, label `network:form.submitter.email`) — tanpa nama/negara/state pengirim → `country` + `state` (dua kolom, `SearchSelect`) → `address` (Input) → `mapsUrl` (Input, **Link Google Maps**, placeholder `network:form.mapsUrlPlaceholder`) → `website` (Input URL) → `contact` (Input) → daftar `socialMedia` (field array) → `activityType`. `NetworkCreateDialog` mengirim `showSubmitter={false}` (dialog penyelenggara event tidak menampilkan email pengirim). `mapsUrl` divalidasi zod sebagai URL **http(s)** opsional (maks 2048, pesan `validation:mapsUrlInvalid`/`mapsUrlMax`): nilai kosong valid, nilai non-http(s) → error per-field `validation:mapsUrlInvalid` via `<FormMessage />`; URL invalid dari sisi server → 422 di-map per-field. Kosong → dikirim `null` (clear). `useCountries`/`useStates` di-query dari panel; `iso2` diturunkan dari nama `country` terpilih (`countries.find(c => c.name === country)?.iso2`). Ganti `country` → reset `state`. **Lokasi diturunkan server-side dari `mapsUrl`**: form hanya mengirim `mapsUrl` (tanpa `lat`/`lng`); server mengurai koordinat (`lat`/`lng` + `embedUrl`) dari link Google Maps, tautan tak terurai/invalid → 422 per-field `mapsUrl`. Opsi yang belum ada di list query disisipkan dari nilai form agar select tidak kosong. Tidak ada peta/picker interaktif pada editor.
- **Gambar di `content`**: editor memakai `useUploadImage` dari fitur **`story`** (`features/story/hooks/use-upload-image`, `POST /images`); network **tidak** menyimpan relasi `Image` — `onImageUploaded` sengaja no-op, URL gambar cukup tertanam di HTML `content`. Error upload non-422 → `toastError(network:errors.uploadFailed)`; 422 tidak di-toast.
- 422 → `mapApiFieldErrors` → `form.setError` per-field (`<FormMessage />` kosong), tanpa toast, **tetap di halaman editor**. Banner hanya non-422.
- **Dialog create reusable** (`network-create-dialog.tsx`, mirip `user/components/author-create-dialog.tsx`): props `{ open, onOpenChange, onCreated(network), title?, description? }`; dipakai field **Penyelenggara** event. Render `{open && <Dialog open onOpenChange>}` (mount kondisional → `useForm` re-init bersih tiap dibuka). Isi = `useForm<NetworkFormValues>` + `createNetworkSchema(t)` + `defaultValues: EMPTY_NETWORK_VALUES` + `<NetworkMetaPanel form disabled={createNetwork.isPending}>` (bukan `NetworkForm` full-page; tanpa `RichTextEditor` karena `content` opsional). `<form id="network-create-form">` wajib `event.stopPropagation()` sebelum `form.handleSubmit` (dialog diportal tapi event React tetap bubble ke `<form>` induk editor event); tombol submit di `DialogFooter` via atribut `form="network-create-form"`. `useCreateNetwork().onSuccess` → `onCreated` + `onOpenChange(false)` + `toastSuccess('network:toast.created')`; non-422 → `toastError(getApiErrorMessage(..., 'network:toast.createFailed'))`; 422 → `setError` per-field (dialog tetap terbuka); banner hanya non-422.
- `EMPTY_NETWORK_VALUES` (`lib/schema.ts`) menggantikan literal `INITIAL_VALUES` di `app/routes/network-new.tsx` (dipakai juga `NetworkCreateDialog`).
- Toast call-site: `network:toast.created/updated/deleted` + `*Failed`; `if (isValidationError(err)) return;`.
- Komponen presentational; data via props; tanpa import lintas fitur — **pengecualian**: import `useUploadImage` dari `features/story` (upload gambar ke `content`) dan `useCountries`/`useStates` dari `features/geo` (data dependency form).

## 7. Permissions

> Kode permission memakai namespace **`network:*`** (mengikuti rename entitas).

| Route / Aksi | Kode |
| --- | --- |
| Route `/networks` (list) | `network:read` (via `RequirePermission`) |
| Route `/networks/new` (editor create) | `network:create` dicek di dalam komponen |
| Route `/networks/:id/edit` (editor edit) | `network:update` dicek di dalam komponen |
| Tombol Tambah → `/networks/new` | `network:create` |
| Aksi Edit baris → `/networks/:id/edit` | `network:update` |
| Setujui usulan (`POST /networks/:id/approve`) | `network:approve` |
| Tolak usulan (`POST /networks/:id/reject`) | `network:reject` |
| Aksi baris Publish (`POST /networks/:id/approve`, `status=DRAFT` atau `REQUEST`) | `network:approve` |
| Aksi baris Submit (`POST /networks/:id/submit`, hanya `status=DRAFT`) | `network:update` |
| Aksi baris Unpublish (`POST /networks/:id/unpublish`, hanya `status=PUBLISHED`) | `network:unpublish` |
| Hapus | `network:delete` |
| Tambah negara bagian inline (form) | `state:create` |
| Tambah kota inline (form) | `city:create` |
| Menu sidebar "Network" | `network:read` |

`state:create`/`city:create` baru: setelah permission ditambahkan ke role, user harus **re-login** (atau refresh `GET /auth/me`) agar `SessionUser.permissions` di `localStorage['auth.user']` ter-update — baris tambah inline baru muncul setelah itu.

Tanpa izin create/update, editor menampilkan empty-state (`network:errors.noCreatePermission`/`noUpdatePermission`) + tombol kembali — tidak memanggil mutation. Detail editor 403 → empty-state `network:errors.forbidden`; error lain → `network:errors.loadDetail` + tombol retry.

403 pada list → empty-state `network:errors.forbidden`.

## 8. Status & Catatan

- **Kolom submission + review**: `Network` diperluas dengan kolom submission/review (`status`, `source`, `organisationType`, `ledBy`, `mapsUrl`, `activityType`, `countryId`, `stateId`, `createdBy`, `approvedAt`, `publishedAt`). Usulan publik (`POST /network-submissions`, `docs/module/network-submission.md`) menulis langsung ke tabel ini (`status=REQUEST`, `source=PUBLIC`); review via `POST /networks/:id/approve|reject` (permission `network:approve`/`network:reject`, hook `use-approve-network`/`use-reject-network` — mirror `use-approve-archive`). Section dashboard "Pending Network Submissions" (`docs/module/dashboard.md` §10k) mengonsumsi `useNetworks({ filter: { status: 'REQUEST' } })`.
- **Banner approve `status=REQUEST` atau `status=DRAFT`**: editor edit merender banner di atas grid konten (props `NetworkForm`: `status`, `canApprove`, `canReject`, `onApprove(payload)`, `onReject()`, semua opsional sehingga `network-new.tsx` tak berubah). Backend kini mengizinkan approver menerbitkan langsung dari `DRAFT` **maupun** `REQUEST`, jadi banner tampil di kedua status (teks `network:workflow.requested` untuk REQUEST, `network:workflow.draft` untuk DRAFT); tombol **Tolak** tetap hanya `status=REQUEST`. Tombol **Setujui** (`network:approve`) memvalidasi form lalu membuka `components/shared/publish-schedule-dialog.tsx` (i18n `network:publishDialog.*`); `handleConfirmApprove` menyimpan field dulu via `PATCH /networks/:id`, lalu `POST /networks/:id/approve` body `{ publishedAt }`, toast `network:toast.approved`, navigasi `/networks`. Tombol **Tolak** (`network:reject`) → `POST /networks/:id/reject` → toast `network:toast.rejected` + navigasi. Error simpan 422/409 tetap di halaman (per-field); error non-422 → toast `updateFailed`/`approveFailed`/`rejectFailed` (reject melewati 422). `isPending` mencakup update/approve/reject.
- **Selesai**: CRUD lengkap + pagination + search + sort server-side + skeleton + forbidden state + permission gating (route, tombol, menu).
- Kolom Aksi hilang bila `network:update`, `network:delete`, `network:unpublish`, dan `network:approve` semuanya `false`. Isi dropdown: **Submit for approval** (`table.submit`, hanya `status=DRAFT` + `network:update`) → **Publish** (`table.publish`, `status=DRAFT` **atau** `REQUEST` + `network:approve`, prop `onPublish`/`canApprove`) → **Unpublish** (`table.unpublish`, hanya `status=PUBLISHED` + `network:unpublish`, prop `canUnpublish`) → **Edit** → **Hapus**. Submit/unpublish di-wire di page lewat props `onSubmit`/`onUnpublish` (`network-table.tsx` presentational) → hook `use-submit-network`/`use-unpublish-network`; toast `network:toast.submitted`/`unpublished`, error non-422 → `submitFailed`/`unpublishFailed`. **Publish** di-wire di page lewat prop `onPublish` → `use-approve-network` + dialog jadwal yang sama dengan banner editor (`components/shared/publish-schedule-dialog.tsx`, i18n `network:publishDialog.*`), konfirmasi → `POST /networks/:id/approve` body `{ publishedAt }` (tanpa PATCH — baris list tidak mengubah field), toast `network:toast.published`, non-422 → `publishFailed`. Approver bisa menerbitkan langsung dari `DRAFT` (aturan backend terbaru); list tetap tidak punya aksi **Reject** baris (reject hanya di banner editor).
- Field `website`, `contact`, `socialMedia` (dinamis, maks 10) ditambahkan pada form create/edit; `socialMedia` ditampilkan juga di detail (list link per platform).
- **Field `mapsUrl` (Link Google Maps)**: ditambahkan pada form create/edit (panel meta, setelah `address`; i18n `network:form.mapsUrl`/`mapsUrlPlaceholder`). Divalidasi URL http(s) opsional (maks 2048) — invalid di klien → error per-field, invalid di server → 422 per-field; dikosongkan → dikirim `null` (clear) via `buildNetworkPayload`. **Sumber lokasi tunggal**: server menurunkan `lat`/`lng` dari `mapsUrl`, jadi form tidak lagi mengirim `lat`/`lng`. Tautan tak terurai/invalid → 422 per-field `mapsUrl`.
- **Rename modul organization → network**: folder `src/features/network/`, komponen/hook/route/i18n namespace `network`, label menu **Network**, dan permission `organization:*` → `network:*`. Role `organization` dihapus dari seeder backend.
- **Iterasi editor full-page + `content`**: create/edit dipindah dari `network-form-dialog.tsx` (dihapus) ke halaman penuh `/networks/new` & `/networks/:id/edit` yang meniru editor Story — `NetworkForm` + `NetworkMetaPanel` + `lib/schema.ts` + `useNetwork`. Field `content` (rich HTML, di-sanitasi backend) ditambah; tabel list kini 5 kolom data + Aksi (`content` hanya di editor). `AppShell` menyembunyikan sidebar pada kedua route editor (breadcrumb Dashboard / Networks / judul).
- **Ekstraksi payload + dialog create reusable**: `buildPayload` (inline di `network-form.tsx`) dipindah verbatim ke `lib/payload.ts:buildNetworkPayload` (dipakai form + dialog); `INITIAL_VALUES` di `network-new.tsx` dipindah ke `lib/schema.ts:EMPTY_NETWORK_VALUES`; komponen baru `components/network-create-dialog.tsx` (dialog create reusable untuk field **Penyelenggara** event).
- **Tambah inline state/city**: `CitySelect` event dipromosikan ke `components/shared/creatable-select.tsx` (`CitySelect`→`CreatableSelect`, `CitySelectProps`→`CreatableSelectProps`, perilaku identik) karena kini dipakai ≥2 fitur; `features/event/components/city-select.tsx` dihapus. Field `state`/`city` panel meta network memakai `CreatableSelect` dengan `canCreate` dari `state:create`/`city:create`; mutasi (`useCreateState`/`useCreateCity`) di-wire langsung di `network-meta-panel.tsx` sehingga `network-new.tsx`/`network-edit.tsx`/`network-create-dialog.tsx` tak berubah. `createNetwork`/`updateNetwork` tidak terpengaruh: form hanya menyimpan ID state/city.

## 9. Bulk update status

Ubah status banyak network sekaligus dari halaman list `/networks` (tanpa membuka editor).

### Alur UI

1. Tabel list punya kolom checkbox leading (`w-10`) bila user punya `network:update` (`canBulkUpdate`; default `true`). Tanpa izin → kolom checkbox tidak dirender **dan** `colSpan` empty-state tidak bergeser (`columnCount` = 6/7 + 1 saat checkbox tampil).
2. Header checkbox = **select-all lintas halaman** untuk `search` + filter status aktif (bukan hanya halaman terlihat). `checked` = `total > 0 && selectedIds.length >= Math.min(total, MAX_BULK_IDS)` (cap keras **2000** ID, jadi bila `total` > 2000 checkbox tetap tercentang penuh setelah fetch select-all mencapai cap); `indeterminate` saat `0 < selectedIds.length < Math.min(total, MAX_BULK_IDS)`. Klik saat belum penuh → `listAllNetworkIds({ search, filter })` (loop `GET /networks` `limit: 100` sampai `total`, cap keras **2000** ID), lalu `setSelectedIds(ids)`; saat penuh → clear. Selama fetch: checkbox disabled + `Loader2` spinner di header. Gagal → `toastError(getApiErrorMessage(err, network:toast.bulkSelectAllFailed))`. `aria-label` `network:bulk.selectAll`.
3. Checkbox baris: `aria-label` `network:bulk.selectRow` (`{{name}}`).
4. Toolbar bulk muncul **hanya** saat `canBulkUpdate` (`network:update`) **dan** `selectedIds.length > 0`, diletakkan di atas tabel **di luar** wrapper `rounded-xl border` (tidak menggeser layout tabel): `text-sm` jumlah terpilih (jumlah **nyata** `selectedIds.length`, mis. "23 dipilih" walau hanya 10 tampil) + (`bulkStatusOptions.length > 0` saja) `Select` status + tombol **Terapkan**, lalu tombol `outline` **Kosongkan** (clear pilihan). Semua disabled saat `bulkPending` (`bulkUpdate.isPending || isSelectingAll`).
   - Opsi status difilter izin (pola sama dengan `stories.tsx`): `REQUEST` bila `can('network:update')` (submit `DRAFT`→`REQUEST`), `PUBLISHED` bila `can('network:approve')`, `DRAFT` bila `can('network:reject') || can('network:unpublish')` (unpublish/reject). `APPROVED` tidak pernah ditawarkan (ditolak backend, 400). `bulkStatusOptions` kosong → `Select` + **Terapkan** disembunyikan (hanya info terpilih + Kosongkan).
   - `bulkStatus` diinisialisasi ke opsi pertama yang bisa dicapai (`bulkStatusOptions[0] ?? 'DRAFT'`) — bukan hardcode `'DRAFT'` yang bisa tak terjangkau. `activeBulkStatus` = `bulkStatus` bila masih ada di `bulkStatusOptions`, kalau tidak fallback ke `bulkStatusOptions[0] ?? 'DRAFT'`.
5. **Terapkan** → `AlertDialog` konfirmasi (jumlah + status target; peringatan tambahan bila target `PUBLISHED`) → `handleBulkApply` **chunk** `selectedIds` per **100** (`ArrayMaxSize(100)` backend), `await mutateAsync` berurutan, jumlahkan `updated`/`skipped`/`failed`. Toast: `network:toast.bulkUpdated` saat `updated > 0`, `network:bulk.skipped` saat `skipped > 0`, `network:bulk.failed` saat `failed > 0`. Chunk gagal → loop berhenti, counter yang sudah terkumpul tetap dilaporkan, dan bila `failed === 0` tampil `network:toast.bulkUpdateFailed` (`getApiErrorMessage`); **pilihan dipertahankan** untuk retry. Tanpa error → dialog ditutup + selection di-clear. `AlertDialogAction` memakai `onClick={e => { e.preventDefault(); handleBulkApply() }}` agar dialog tetap terbuka selama pending dan hanya tertutup saat sukses. Ini bukan form, jadi **400/422 juga lewat toast** (tanpa `form.setError`/jalur senyap).
6. Seleksi **bertahan lintas halaman** (select-all tetap berlaku saat pindah halaman): tanpa prune. Reset hanya saat `debouncedSearch`/`statusFilter`/`sortBy`/`sortOrder` berubah. ID usang (mis. baris sudah dihapus) tidak merusak batch — transisi per-id, baris hilang dihitung `skipped` (404), jadi tidak perlu dibersihkan dari pilihan.

### Kontrak endpoint

| Endpoint | Body | Response | Permission |
| --- | --- | --- | --- |
| `POST /networks/bulk-status` | `{ ids: string[], status: 'DRAFT'\|'REQUEST'\|'PUBLISHED' }` (`ids` 1..100 UUID) | `{ data: { updated: number, skipped: number, failed: number }, message }` | `network:update` (target `DRAFT` butuh `network:reject`/`network:unpublish`, `REQUEST` butuh `network:update`, `PUBLISHED` butuh `network:approve`; status lain → 400) |

FE: `bulkUpdateNetworkStatus(input)` di `api/networks.ts`, type `BulkUpdateNetworkStatusInput` di `types.ts`, hook `hooks/use-bulk-update-network-status.ts` (`useMutation`, `onSettled` invalidate `['network']` — sekali saja; tanpa toast — toast di call-site).

Select-all lintas halaman: `listAllNetworkIds({ search, filter })` di `api/networks.ts` — loop `listNetworks` `limit: 100` per halaman sampai `total` tercapai, cap keras 2000 ID, mengembalikan `string[]`. Batch submit: `handleBulkApply` memotong `selectedIds` per 100 dan mengirim berurutan (`await`), counter `updated`/`skipped`/`failed` dijumlahkan lintas chunk; berhenti di kegagalan pertama tanpa menghapus pilihan. `skipped` = status item tidak memungkinkan transisi / baris hilang (404), `failed` = error server per item (praktis tak tercapai — izin kurang gagal sebagai 403 seluruh request di awal).

`BulkNetworkStatus = Extract<NetworkStatus, 'DRAFT' | 'REQUEST' | 'PUBLISHED'>` di `types.ts` (dipakai `BulkUpdateNetworkStatusInput.status` + state `bulkStatus`), `BulkUpdateNetworkStatusResult = { updated, skipped, failed }` dikembalikan `bulkUpdateNetworkStatus`.

### i18n

`bulk.selectAll`, `bulk.selectRow`, `bulk.selected_one`/`bulk.selected` (interpolasi `{{count}}`, `selected` sebagai fallback plural), `bulk.statusLabel`, `bulk.apply`, `bulk.clear` ("Kosongkan"), `bulk.confirmTitle`, `bulk.confirmDescription` (`{{count}}`, `{{status}}`), `bulk.publishWarning`, `bulk.confirm`, `bulk.cancel` ("Batal"), `bulk.skipped_one`/`bulk.skipped`, `bulk.failed_one`/`bulk.failed` (interpolasi `{{count}}`), `toast.bulkUpdated` (`{{count}}`), `toast.bulkUpdateFailed`, `toast.bulkSelectAllFailed`. Aksi baris: `table.submit`, `table.publish`, `table.unpublish`, `toast.submitted`, `toast.submitFailed`, `toast.published`, `toast.publishFailed`, `toast.unpublished`, `toast.unpublishFailed`, `workflow.draft` (banner DRAFT). Parity `id`/`en`.
