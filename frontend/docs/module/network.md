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
│   ├── schema.ts                         # createNetworkSchema + NetworkFormValues + EMPTY_NETWORK_VALUES
│   └── payload.ts                        # buildNetworkPayload (dipakai form full-page & dialog create)
├── hooks/
│   ├── use-networks.ts                   # query ['networks', {page,limit,search,sortBy,sortOrder}]
│   ├── use-network.ts                    # query ['network', {id}] (detail edit, staleTime 30s)
│   ├── use-create-network.ts             # invalidate ['networks']
│   ├── use-update-network.ts             # invalidate ['networks'] + ['network', {id}]
│   └── use-delete-network.ts
└── components/
    ├── network-table.tsx                 # presentational + DropdownMenu Edit/Hapus
    ├── network-form.tsx                  # form editor full-page (RHF + zod, 2 kolom)
    ├── network-meta-panel.tsx            # panel kanan: name/country/state/address/website/contact/socialMedia/LocationMapPicker
    ├── network-create-dialog.tsx         # Dialog create reusable (NetworkMetaPanel + buildNetworkPayload, mirip AuthorCreateDialog)
    └── delete-network-dialog.tsx         # AlertDialog konfirmasi hapus
```

Komponen shared reusable: `src/components/shared/search-select.tsx` — single-select searchable combobox (`Popover` + `Command`, role `combobox`, centang item terpilih) yang dipakai form network untuk memilih `country`/`state`; presentational, tanpa fetch (opsi + label via props).

Data referensi geo berasal dari fitur bersama **`src/features/geo/`**: `features/geo/api/geo.ts` (`listCountries`, `listStatesByCountry` — paginasi loop limit 100), `features/geo/hooks/use-countries.ts` (query `['geo','countries']`, staleTime 24h), `features/geo/hooks/use-states.ts` (query `['geo','states', iso2]`, staleTime 1h). Editor network **tidak lagi** menyimpan `api/geo.ts`/`use-countries.ts`/`use-states.ts` di folder fitur sendiri. Editor konten memakai `src/components/shared/rich-text-editor.tsx` (shared, dipakai juga story/event).

Komponen shared lain: `src/components/shared/location-map-picker.tsx` — peta Leaflet/OSM presentational (pencarian alamat Nominatim + klik peta + marker draggable) yang juga dipakai modul `event`. Ikon/i18n `location:*`; nilai masuk via props.

## 4. Komponen yang Ditambah (via CLI)

Tidak ada komponen `components/ui/` baru — memakai `table`, `alert-dialog`, `button`, `dropdown-menu`, `form`, `input`, `skeleton` yang sudah ada (plus komponen shared `search-select`/`location-map-picker`/`rich-text-editor`, dan `useFieldArray` react-hook-form untuk daftar sosial media). Larang edit manual `src/components/ui/`.

## 5. Kontrak API

Envelope: sukses `{ data, message }`; list `{ data, meta:{page,limit,total}, message }`; error `{ statusCode, message, errors }`.

| Endpoint | Body | Keterangan |
| --- | --- | --- |
| `POST /networks` | `{ name, state?, country?, address?, website?, contact?, socialMedia?, content?, lat?, lng? }` | `name` wajib max200; `website?` max500; `contact?` max200; `socialMedia?` maks 10 entri `{ platform(1..50), url(1..500) }`; `content?` rich HTML max100000 (disanitasi backend); `lat` number -90..90; `lng` number -180..180. |
| `GET /networks?page=&limit=` | — | list paginated. |
| `GET /networks?search=&sortBy=&sortOrder=` | — | search OR like `name,state,country,address`; <2 char diabaikan; `sortBy=state` didukung. |
| `GET /networks/:id` | — | detail (dipakai editor edit; termasuk `content`). |
| `PATCH /networks/:id` | field opsional | body kosong = tanpa perubahan. |
| `DELETE /networks/:id` | — | hapus; relasi user/billing `SetNull`. |

`buildNetworkPayload` (`lib/payload.ts`; dipakai `network-form.tsx` **dan** `network-create-dialog.tsx`, satu implementasi) mengirim field opsional kosong sebagai **`null` eksplisit** (bukan di-omit): `state`/`country`/`address`/`website`/`contact`/`content` → `null` saat kosong, `lat`/`lng` → `null` bila string kosong (Number bila terisi). `socialMedia` → array entri terisi, atau `null` bila tak ada entri (baris platform/url kosong **di-strip sebelum submit**). Backend memetakan `null` → clear.

NetworkEntity: `{ id, name, state|null, country|null, address|null, website|null, contact|null, socialMedia|null, content|null, lat|null, lng|null, createdAt, updatedAt }` (`content` = rich HTML; `state` menggantikan `city`; `socialMedia` = `{ platform, url }[] | null`).

### Data referensi geo (PUBLIC)

| Endpoint | Keterangan |
| --- | --- |
| `GET /countries?page=&limit=&sortBy=name&sortOrder=asc` | item `{ id:number, name:string, iso2:string, ... }`. `listCountries` loop paginasi (limit 100). |
| `GET /states?filter[countryCode]=<ISO2>&page=&limit=&sortBy=name&sortOrder=asc` | item `{ id:number, name:string, countryCode:string, ... }`. `listStatesByCountry(iso2)` loop paginasi. |

Field form `country` & `state` menyimpan **nama** (value=label=name). `iso2` diturunkan dari nama country terpilih (`countries.find(c => c.name === country)?.iso2`). Endpoint publik — kegagalan load tidak memblokir submit.

### Searchable / Sortable

- **Searchable**: `name`, `state`, `country`, `address`. Placeholder: "Cari nama, negara bagian, negara, atau alamat...".
- **Sortable** (semua kolom tampil): `name`, `state`, `country`, `createdAt` (+ `address`, `updatedAt` didukung backend).
- Contoh query: `GET /api/v1/networks?page=1&limit=10&search=gamelan&sortBy=state&sortOrder=asc`.

## 6. Konvensi (AGENTS.md)

- Query key `['networks', { page, limit, search, sortBy, sortOrder }]`, `placeholderData: keepPreviousData`, `staleTime: 30_000`.
- Search debounce 400ms (`useDebouncedValue`); ubah search/sort → `setPage(1)`; halaman di luar jangkauan di-clamp.
- Form **RHF + zod**, schema `useMemo(..., [t])`, pesan dari `t('validation:*')`; angka opsional disimpan sebagai string lalu dikonversi saat submit (`lat`/`lng` dikirim number JSON).
- **Sosial media dinamis**: `socialMedia` dikelola via `useFieldArray` react-hook-form (platform + url per baris, tombol tambah/hapus, maks 10 entri). Baris dengan platform **dan** url kosong di-strip di `buildPayload`; baris terisi wajib lengkap (superRefine zod → pesan per-field via `<FormMessage />`).
- **Country/state via `SearchSelect`**: field `country` dan `state` memakai `components/shared/search-select.tsx` (presentational). Opsi country dari `useCountries` (staleTime 24h), opsi state dari `useStates(iso2)` (staleTime 1h, `enabled` bila `iso2` ada). `iso2` = `countries.find(c => c.name === countryValue)?.iso2`. State select `disabled` bila country belum dipilih / query pending. Ganti country → `form.setValue('state', '', { shouldDirty, shouldValidate })` (nama state tidak berlaku lintas negara).
- **Layout editor full-page** (`network-form.tsx`, meniru `story-form.tsx`): grid **70/30 tanpa gap** (`lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]`) — kolom kiri `RichTextEditor` (shared) untuk field `content`, kolom kanan kartu panel meta (`network-meta-panel.tsx`). Panel kanan bisa disembunyikan/ditampilkan via state `showSettings`: tombol `PanelRightClose` (header kartu) menyembunyikan, `PanelRightOpen` (`absolute right-2 top-2 z-10`) menampilkan; saat tersembunyi grid jadi 1 kolom penuh dan tombol **Simpan** tetap tampil di kanan-atas. Full-height desktop (`lg:h-svh lg:overflow-hidden` di `AppShell` → `lg:min-h-0` di route/form/grid); mobile scroll normal. Kartu tanpa `rounded`/`shadow`, pemisah hanya border.
- **Field panel meta** (`network-meta-panel.tsx`, urutan): `name` (Input) → `country` + `state` (dua kolom, `SearchSelect`) → `address` (Input) → `website` (Input URL) → `contact` (Input) → daftar `socialMedia` (field array) → `LocationMapPicker` (shared) di bawah label `network:form.mapLabel`. `useCountries`/`useStates` di-query dari panel; `iso2` diturunkan dari nama `country` terpilih (`countries.find(c => c.name === country)?.iso2`). Ganti `country` → reset `state`. `lat`/`lng` **tidak ditampilkan sebagai input** — hanya diset dari peta (`form.setValue('lat'|'lng', …, { shouldDirty: true, shouldValidate: true })`) dan tetap tervalidasi zod + dikirim `buildPayload`. Field `address` independen penuh dari peta; map menyediakan search-by-address (Nominatim) + drag marker yang hanya mengisi lat/lng. Opsi yang belum ada di list query disisipkan dari nilai form agar select tidak kosong.
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
| Hapus | `network:delete` |
| Menu sidebar "Network" | `network:read` |

Tanpa izin create/update, editor menampilkan empty-state (`network:errors.noCreatePermission`/`noUpdatePermission`) + tombol kembali — tidak memanggil mutation. Detail editor 403 → empty-state `network:errors.forbidden`; error lain → `network:errors.loadDetail` + tombol retry.

403 pada list → empty-state `network:errors.forbidden`.

## 8. Status & Catatan

- **Selesai**: CRUD lengkap + pagination + search + sort server-side + skeleton + forbidden state + permission gating (route, tombol, menu).
- Kolom Aksi hilang bila `network:update` dan `network:delete` keduanya `false`.
- Field `website`, `contact`, `socialMedia` (dinamis, maks 10) ditambahkan pada form create/edit; `socialMedia` ditampilkan juga di detail (list link per platform).
- **Rename modul organization → network**: folder `src/features/network/`, komponen/hook/route/i18n namespace `network`, label menu **Network**, dan permission `organization:*` → `network:*`. Role `organization` dihapus dari seeder backend.
- **Iterasi editor full-page + `content`**: create/edit dipindah dari `network-form-dialog.tsx` (dihapus) ke halaman penuh `/networks/new` & `/networks/:id/edit` yang meniru editor Story — `NetworkForm` + `NetworkMetaPanel` + `lib/schema.ts` + `useNetwork`. Field `content` (rich HTML, di-sanitasi backend) ditambah; tabel list tetap 4 kolom + Aksi (`content` hanya di editor). `AppShell` menyembunyikan sidebar pada kedua route editor (breadcrumb Dashboard / Networks / judul).
- **Ekstraksi payload + dialog create reusable**: `buildPayload` (inline di `network-form.tsx`) dipindah verbatim ke `lib/payload.ts:buildNetworkPayload` (dipakai form + dialog); `INITIAL_VALUES` di `network-new.tsx` dipindah ke `lib/schema.ts:EMPTY_NETWORK_VALUES`; komponen baru `components/network-create-dialog.tsx` (dialog create reusable untuk field **Penyelenggara** event).
