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
├── api/organizations.ts                  # listOrganizations, create/update/delete
├── hooks/
│   ├── use-organizations.ts              # query ['organizations', {page,limit,search,sortBy,sortOrder}]
│   ├── use-create-organization.ts        # invalidate ['organizations']
│   ├── use-update-organization.ts
│   └── use-delete-organization.ts
└── components/
    ├── organization-table.tsx            # presentational + DropdownMenu Edit/Hapus
    ├── organization-form-dialog.tsx      # Dialog form create/edit (RHF + zod)
    └── delete-organization-dialog.tsx    # AlertDialog konfirmasi hapus
```

## 4. Komponen yang Ditambah (via CLI)

Tidak ada komponen `components/ui/` baru — memakai `table`, `dialog`, `alert-dialog`, `select`, `badge`, `form`, `input`, `dropdown-menu`, `skeleton` yang sudah ada. Larang edit manual `src/components/ui/`.

## 5. Kontrak API

Envelope: sukses `{ data, message }`; list `{ data, meta:{page,limit,total}, message }`; error `{ statusCode, message, errors }`.

| Endpoint | Body | Keterangan |
| --- | --- | --- |
| `POST /organizations` | `{ name, city?, country?, address?, lat?, lng? }` | `name` wajib max200; `lat` number -90..90; `lng` number -180..180. |
| `GET /organizations?page=&limit=` | — | list paginated. |
| `GET /organizations?search=&sortBy=&sortOrder=` | — | search OR like `name,city,country,address`; <2 char diabaikan. |
| `PATCH /organizations/:id` | field opsional | body kosong = tanpa perubahan. |
| `DELETE /organizations/:id` | — | hapus; relasi user/billing `SetNull`. |

OrganizationEntity: `{ id, name, city|null, country|null, address|null, lat|null, lng|null, createdAt, updatedAt }`.

### Searchable / Sortable

- **Searchable**: `name`, `city`, `country`, `address`. Placeholder: "Cari nama, kota, negara, atau alamat...".
- **Sortable** (semua kolom tampil): `name`, `city`, `country`, `createdAt` (+ `address`, `updatedAt` didukung backend).
- Contoh query: `GET /api/v1/organizations?page=1&limit=10&search=gamelan&sortBy=name&sortOrder=asc`.

## 6. Konvensi (AGENTS.md)

- Query key `['organizations', { page, limit, search, sortBy, sortOrder }]`, `placeholderData: keepPreviousData`, `staleTime: 30_000`.
- Search debounce 400ms (`useDebouncedValue`); ubah search/sort → `setPage(1)`; halaman di luar jangkauan di-clamp.
- Form **RHF + zod**, schema `useMemo(..., [t])`, pesan dari `t('validation:*')`; angka opsional disimpan sebagai string lalu dikonversi saat submit (`lat`/`lng` dikirim number JSON).
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
