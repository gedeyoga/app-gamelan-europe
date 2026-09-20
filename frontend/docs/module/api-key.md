# Module: API Key — Brief

Halaman manajemen **API key** untuk akses data via header `x-api-key`. Tiap key punya permission custom (`resource:action`), tanpa expiry; akses dicabut dengan DELETE permanen. DB hanya menyimpan hash — raw key tampil **sekali** saat create.

Mengikuti konvensi `AGENTS.md` frontend; meniru pola modul `role` (dialog create/edit + permission picker).

## 1. Tujuan

- CRUD API key di `/api-keys` (create, edit, delete, lihat daftar) + copy-once raw key.
- Envelope backend di-unwrap `lib/api-client.ts` (`request`/`requestList`).
- Logika data di container route; komponen feature presentational.

## 2. Routing

- `src/app/routes/api-keys.tsx` — halaman `/api-keys`, guard `<RequirePermission code="apikey:read">`.
- Nav di grup **Data Management** `app-shell.tsx` (ikon `KeyRound`, permission `apikey:read`, label `dashboard:nav.apiKey`).

## 3. Struktur File

```
src/features/api-key/
├── types.ts
├── api/api-keys.ts                      # listApiKeys, getApiKey, createApiKey, updateApiKey, deleteApiKey
├── lib/schema.ts                        # createApiKeyFormSchema(t)
├── hooks/
│   ├── use-api-keys.ts                  # query ['api-key', { page, limit, search, sortBy, sortOrder }]
│   ├── use-api-key.ts                   # query ['api-key', id] (detail, enabled bila id)
│   ├── use-create-api-key.ts            # invalidate ['api-key']
│   ├── use-update-api-key.ts            # invalidate ['api-key'] + ['api-key', id]
│   └── use-delete-api-key.ts            # invalidate ['api-key']
└── components/
    ├── api-key-table.tsx                # tabel presentasional + masked key + badge permission
    ├── api-key-form.tsx                 # dialog create/edit (RHF + zod)
    ├── permission-multiselect.tsx       # multi-pilih permission (searchable)
    ├── api-key-created-dialog.tsx       # copy-once raw key
    └── delete-api-key-dialog.tsx        # konfirmasi hapus permanen
```

Komponen baru via CLI: tidak ada (`dialog`, `form`, `checkbox`, `badge`, `alert-dialog`, `skeleton` sudah tersedia).

## 4. Kontrak API

| Metode | Endpoint                          | Body/Param                          | Catatan |
| ------ | --------------------------------- | ----------------------------------- | ------- |
| GET    | `/api-keys?page&limit&search&sortBy&sortOrder` | search OR like `name`; `sortBy` ∈ `name,prefix,lastUsedAt,createdAt` | `requestList`; default `createdAt desc` |
| GET    | `/api-keys/:id`                   | —                                   | `request`; tanpa `key` |
| POST   | `/api-keys`                       | `{ name, permissionCodes: string[] }` | `request`; response berisi `key` raw (sekali) |
| PATCH  | `/api-keys/:id`                   | `{ name?, permissionCodes? }`       | `request` |
| DELETE | `/api-keys/:id`                   | —                                   | `request<null>`; akses dicabut permanen |
| GET    | `/permissions?page&limit`         | —                                   | `requestList` (picker) |

- Permission RBAC: `apikey:create`, `apikey:read`, `apikey:update`, `apikey:delete`.
- `search` <2 char diabaikan; sort klik header cycle `asc → desc → null`.

## 5. Komponen & Perilaku

- `api-key-table.tsx`: kolom **Name** (`name`, sortable), **Key** (`prefix` + `••••••••`, sortable `prefix`), **Permissions** (badge `secondary`, mono, non-sortable — array), **Last Used** (`lastUsedAt`, sortable; `"Belum pernah"` bila null), **Created** (`createdAt`, sortable), **Actions** (Edit/Delete). Tabel **tidak menampilkan raw key/hash**.
- `api-key-form.tsx`: dialog RHF+zod; field `name` (Input) + `permissionCodes` via `PermissionMultiSelect`; `<FormMessage/>` kosong tiap field; 422 di-map per-field via `mapApiFieldErrors`; banner hanya non-422.
- `permission-multiselect.tsx`: searchable client-side (`code`/`description`), pilih semua/hapus semua filter-aware; daftar permission di-inject container (`usePermissions`), bukan fetch di komponen.
- `api-key-created-dialog.tsx`: **copy-once** — raw key read-only monospace + tombol Copy; setelah 1x sukses tombol disabled + `"Tersalin"`; peringatan `"Salin sekarang. Key tidak bisa dilihat lagi."`; tutup dialog membuang raw key dari state container.
- `delete-api-key-dialog.tsx`: `alert-dialog`, menjelaskan akses langsung dicabut permanen.

## 6. Konvensi

- Query key domain `['api-key', ...]`; `placeholderData: keepPreviousData`; invalidate di `onSuccess` tiap mutation.
- Toast CUD di **call-site** (`api-keys.tsx`): `api-key:toast.created/updated/deleted` + `*Failed`; 422 early-return `isValidationError` (dialog tetap terbuka, tanpa toast).
- Validasi dari `t('validation:*')`, termasuk `validation:permissionRequired` (array min 1).
- Tanggal via `formatDateTime` `@/lib/datetime`.
- Cross-feature import type `Permission` dari `@/features/permission/types` di `permission-multiselect.tsx`/`api-key-form.tsx` — pengecualian disengaja (data dependency picker).
- Search bar shared `SearchBar` + debounce 400ms + reset `page=1`; sortable via `SortableHeader`; pagination `DataTablePagination` 10/page.

## 7. Permissions

| Route / Aksi | Kode |
| --- | --- |
| Route `/api-keys` | `apikey:read` (tanpa akses → `/403`) |
| Tombol "Buat API Key" | `apikey:create` |
| Aksi Edit (`canUpdate`) | `apikey:update` |
| Aksi Hapus (`canDelete`) | `apikey:delete` |
| Daftar permission di form (`GET /permissions`) | `permission:read` (403 → banner) |
| Menu sidebar "API Keys" | `apikey:read` |

## 8. Status & Catatan

- **Status**: ✅ Selesai — CRUD + permission picker + copy-once + pagination/search/sort + gating; `pnpm lint` (0 error), `tsc --noEmit`, `pnpm build` bersih.
- Kolom `permissions` non-sortable (array) — dikecualikan dari aturan "semua kolom sortable"; `key`/hash tidak pernah dirender.
- Raw key hanya hidup di state `createdKey` (`CreatedApiKey`) selama dialog copy-once terbuka.
