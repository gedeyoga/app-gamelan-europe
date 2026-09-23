# Module: Organization — Brief

Dokumen ini mencatat desain/implementasi halaman **Organizations** pada frontend React — CRUD lengkap organisasi (list paginated, create, update, delete). Mengikuti konvensi `frontend/AGENTS.md` dan format brief `docs/module/user.md`.

## 1. Tujuan & Ruang Lingkup

- Menyediakan **CRUD organization** admin-only: lihat daftar (pagination), tambah, edit (nama/lokasi/koordinat), hapus.
- Konsumsi API `backend/` modul organization (`backend/docs/modules/organization.md`), prefix global `/api/v1`, butuh JWT Bearer + permission `organization:*`.

## 2. Routing

- Route: `/organizations`, nested di bawah `/` protected (`DashboardLayout`), dibungkus `<RequirePermission code="organization:read">`.
- Container page: `src/app/routes/organizations.tsx` (`OrganizationsPage`).

```
/organizations  → halaman CRUD Organizations
```

## 3. Struktur File

```
src/app/routes/organizations.tsx          # container: state page/search/sort, mutation, dialog

src/features/organization/
├── types.ts                              # Organization, Create/UpdateOrganizationInput
├── api/
│   ├── organizations.ts                  # listOrganizations, create/update/delete
│   └── geo.ts                            # listCountries, listStatesByCountry (data referensi publik)
├── hooks/
│   ├── use-organizations.ts              # query ['organizations', {page,limit,search,sortBy,sortOrder}]
│   ├── use-countries.ts                  # query ['countries'] (staleTime 24h)
│   ├── use-states.ts                     # query ['states', iso2] (staleTime 1h)
│   ├── use-create-organization.ts        # invalidate ['organizations']
│   ├── use-update-organization.ts
│   └── use-delete-organization.ts
└── components/
    ├── organization-table.tsx            # presentational + DropdownMenu Edit/Hapus
    ├── organization-form-dialog.tsx      # Dialog form create/edit (RHF + zod)
    └── delete-organization-dialog.tsx    # AlertDialog konfirmasi hapus
```

Komponen shared reusable: `src/components/shared/search-select.tsx` — single-select searchable combobox (`Popover` + `Command`, role `combobox`, centang item terpilih) yang dipakai form organization untuk memilih `country`/`state`; presentational, tanpa fetch (opsi + label via props).

Komponen shared lain: `src/components/shared/location-map-picker.tsx` — peta Leaflet/OSM presentational (pencarian alamat Nominatim + klik peta + marker draggable) yang juga dipakai modul `event`. Ikon/i18n `location:*`; nilai masuk via props.

## 4. Komponen yang Ditambah (via CLI)

Tidak ada komponen `components/ui/` baru — memakai `table`, `dialog`, `alert-dialog`, `select`, `badge`, `form`, `input`, `dropdown-menu`, `popover`, `command`, `skeleton` yang sudah ada. Larang edit manual `src/components/ui/`.

## 5. Kontrak API

Envelope: sukses `{ data, message }`; list `{ data, meta:{page,limit,total}, message }`; error `{ statusCode, message, errors }`.

| Endpoint | Body | Keterangan |
| --- | --- | --- |
| `POST /organizations` | `{ name, state?, country?, address?, lat?, lng? }` | `name` wajib max200; `lat` number -90..90; `lng` number -180..180. |
| `GET /organizations?page=&limit=` | — | list paginated. |
| `GET /organizations?search=&sortBy=&sortOrder=` | — | search OR like `name,state,country,address`; <2 char diabaikan; `sortBy=state` didukung. |
| `PATCH /organizations/:id` | field opsional | body kosong = tanpa perubahan. |
| `DELETE /organizations/:id` | — | hapus; relasi user/billing `SetNull`. |

OrganizationEntity: `{ id, name, state|null, country|null, address|null, lat|null, lng|null, createdAt, updatedAt }` (`state` menggantikan `city`).

### Data referensi geo (PUBLIC)

| Endpoint | Keterangan |
| --- | --- |
| `GET /countries?page=&limit=&sortBy=name&sortOrder=asc` | item `{ id:number, name:string, iso2:string, ... }`. `listCountries` loop paginasi (limit 100). |
| `GET /states?filter[countryCode]=<ISO2>&page=&limit=&sortBy=name&sortOrder=asc` | item `{ id:number, name:string, countryCode:string, ... }`. `listStatesByCountry(iso2)` loop paginasi. |

Field form `country` & `state` menyimpan **nama** (value=label=name). `iso2` diturunkan dari nama country terpilih (`countries.find(c => c.name === country)?.iso2`). Endpoint publik — kegagalan load tidak memblokir submit.

### Searchable / Sortable

- **Searchable**: `name`, `state`, `country`, `address`. Placeholder: "Cari nama, negara bagian, negara, atau alamat...".
- **Sortable** (semua kolom tampil): `name`, `state`, `country`, `createdAt` (+ `address`, `updatedAt` didukung backend).
- Contoh query: `GET /api/v1/organizations?page=1&limit=10&search=gamelan&sortBy=state&sortOrder=asc`.

## 6. Konvensi (AGENTS.md)

- Query key `['organizations', { page, limit, search, sortBy, sortOrder }]`, `placeholderData: keepPreviousData`, `staleTime: 30_000`.
- Search debounce 400ms (`useDebouncedValue`); ubah search/sort → `setPage(1)`; halaman di luar jangkauan di-clamp.
- Form **RHF + zod**, schema `useMemo(..., [t])`, pesan dari `t('validation:*')`; angka opsional disimpan sebagai string lalu dikonversi saat submit (`lat`/`lng` dikirim number JSON).
- **Country/state via `SearchSelect`**: field `country` dan `state` memakai `components/shared/search-select.tsx` (presentational). Opsi country dari `useCountries` (staleTime 24h), opsi state dari `useStates(iso2)` (staleTime 1h, `enabled` bila `iso2` ada). `iso2` = `countries.find(c => c.name === countryValue)?.iso2`. State select `disabled` bila country belum dipilih / query pending. Ganti country → `form.setValue('state', '', { shouldDirty, shouldValidate })` (nama state tidak berlaku lintas negara).
- **Lokasi via peta**: `organization-form-dialog.tsx` menampilkan `LocationMapPicker` (shared) di bawah field `address` independen, dibungkus label `organization:form.mapLabel`; dialog dilebarkan `sm:max-w-2xl`. `lat`/`lng` **tidak ditampilkan sebagai input** — hanya diset dari peta (`form.setValue('lat'|'lng', …, { shouldDirty: true })`) dan tetap tervalidasi zod + dikirim `buildPayload`. Field `address` independen penuh dari peta: `LocationMapPicker` tidak dikirim `address`/`onAddressChange` (keduanya opsional); map menyediakan search-by-address (Nominatim) + drag marker yang hanya mengisi lat/lng.
- 422 → `mapApiFieldErrors` → `form.setError` per-field (`<FormMessage />` kosong), tanpa toast, dialog tetap terbuka. Banner hanya non-422.
- Toast call-site: `organization:toast.created/updated/deleted` + `*Failed`; `if (isValidationError(err)) return;`.
- Komponen presentational; data via props; tanpa import lintas fitur.

## 7. Permissions

| Route / Aksi | Kode |
| --- | --- |
| Route `/organizations` | `organization:read` |
| Tombol Tambah | `organization:create` |
| Edit | `organization:update` |
| Hapus | `organization:delete` |
| Menu sidebar "Organizations" | `organization:read` |

403 pada list → empty-state `organization:errors.forbidden`.

## 8. Status & Catatan

- **Selesai**: CRUD lengkap + pagination + search + sort server-side + skeleton + forbidden state + permission gating (route, tombol, menu).
- Kolom Aksi hilang bila `organization:update` dan `organization:delete` keduanya `false`.
