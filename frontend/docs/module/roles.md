# Module: Roles — Brief

Dokumen ini mencatat desain/implementasi halaman **Roles** pada frontend React (CRUD role). Mengikuti konvensi `AGENTS.md` frontend dan meniru pola modul `user` yang sudah ada.

## 1. Tujuan

- Menyediakan halaman CRUD **role** (tambah, edit, hapus, lihat daftar) di `/roles`.
- Data diambil dari `GET /roles` backend NestJS, envelope di-unwrap oleh `lib/api-client.ts` (`request`/`requestList`).
- Logika data di container route; komponen feature **presentational** (props via `interface`).

## 2. Routing

- `src/app/routes/roles.tsx` — halaman `/roles` (**protected** oleh `AppShell`/`ProtectedRoute`).

## 3. Komponen

Tambah via CLI:

```
pnpm dlx shadcn@latest add textarea
pnpm dlx shadcn@latest add checkbox
```

- `textarea` ditambahkan karena dashboard/user belum membutuhkannya; dipakai field deskripsi.
- `checkbox` ditambahkan untuk daftar pilihan permission di form dialog.
- `dialog`, `form`, `input`, `button`, `table`, `dropdown-menu`, `alert-dialog`, `skeleton` sudah tersedia.

Struktur file:

```
src/features/role/
├── api/roles-api.ts                 # listRoles, createRole, updateRole, deleteRole, listRolePermissions, replaceRolePermissions
├── types.ts                         # Role, CreateRoleInput, UpdateRoleInput, RolePermission
├── hooks/
│   ├── use-roles.ts                 # query ['roles']
│   ├── use-create-role.ts           # invalidate ['roles']
│   ├── use-update-role.ts           # invalidate ['roles']
│   ├── use-delete-role.ts           # invalidate ['roles']
│   ├── use-role-permissions.ts      # query ['roles', roleId, 'permissions']
│   └── use-replace-role-permissions.ts  # invalidate ['roles', roleId, 'permissions'] + ['roles']
└── components/
    ├── role-table.tsx               # tabel presentasional (Nama/Deskripsi/Dibuat/Aksi)
    ├── role-form-dialog.tsx         # dialog tambah/edit (nested dialog + form + daftar permission)
    └── role-delete-dialog.tsx       # konfirmasi hapus (alert-dialog)
```

Domain pendukung (permission) — data dependency dari dialog:

```
src/features/permission/
├── types.ts                         # Permission
├── api/permissions-api.ts           # listPermissions() → GET /permissions?page=1&limit=100
└── hooks/use-permissions.ts         # query ['permissions'], staleTime 60s
```

- `role-table.tsx`: props `{ items, onEdit, onDelete }`; kolom Nama, Deskripsi, Dibuat (`formatDateTime` dari `@/lib/datetime` — tanggal+jam, zona client, locale browser), Aksi (dropdown Edit/Hapus); empty state "Belum ada role".
- `role-form-dialog.tsx`: dialog reusable untuk create/edit; field Nama (wajib) + Deskripsi (opsional, `Textarea`) + bagian **Permissions** (daftar `checkbox` scrollable `max-h-56`, satu baris per permission menampilkan `code` monospace + `description` opsional); validasi zod; props via `interface` (termasuk `permissions`, `initialPermissionIds`, `isPermissionPending`, `permissionError`); presentasional — seleksi dikelola state lokal `useState<string[]>(initialPermissionIds)` dan dikirim lewat `onSubmit(payload, permissionIds)`. Import tipe `Permission` dari `@/features/permission/types` — **pengecualian** cross-feature yang disengaja (data dependency dialog). Bagian Permissions dilengkapi kotak pencarian (`state search`, filter case-insensitive pada `code`/`description`, placeholder "Cari permission..." — kosong saat tak ada hasil menampilkan "Tidak ada permission yang cocok") serta tombol **Pilih semua** / **Hapus semua** yang bekerja terhadap set permission yang sedang terfilter (filter-aware): union/remove tanpa menyentuh id di luar filter; tanpa filter, tombol berlaku ke seluruh list.
- `role-delete-dialog.tsx`: konfirmasi `alert-dialog`; menampilkan catatan bahwa role yang masih dipakai user tidak bisa dihapus.

## 4. Kontrak API

| Metode | Endpoint          | Body/Param                      | Dipakai               |
| ------ | ----------------- | ------------------------------- | --------------------- |
| GET    | `/roles?page&limit` | —                               | `requestList`         |
| GET    | `/roles?search=&sortBy=&sortOrder=` | `search` OR like `name,description`; `sortBy` ∈ `name,description,createdAt,updatedAt` | search <2 char diabaikan; sort klik header; default `createdAt desc` |
| POST   | `/roles`          | `{ name, description? }` → 201  | `request`             |
| PATCH  | `/roles/:id`      | `{ name?, description? }`       | `request`             |
| DELETE | `/roles/:id`      | —                               | `request`             |
|        |                   | 409 "Role is still assigned to users" saat role dipakai | `request` |
| GET    | `/permissions?page=1&limit=100` | — | `requestList` |
| GET    | `/roles/:id/permissions` | — | `request` |
| PUT    | `/roles/:id/permissions` | `{ permissionIds: string[] }` (full replace, `[]` mengosongkan) | `request` |

- Envelope backend di-unwrap di `lib/api-client.ts` — tiap fungsi api hanya mengembalikan `Role`/`ListResult<Role>`/`RolePermission[]`.
- Endpoint dilindungi permission: `role:create`, `role:read`, `role:update`, `role:delete` (backend).
- Endpoint permission: `GET /permissions` & `GET /roles/:id/permissions` butuh `permission:read`; `PUT /roles/:id/permissions` butuh `permission:update`. Jika role yang login tidak punya permission ini, list/assign akan error (query gagal → dialog tidak terbuka di edit, banner partial-failure di create).

## 5. Konvensi (AGENTS.md)

- Query key `['roles', { page, limit, search, sortBy, sortOrder }]` (+ `['roles', roleId, 'permissions']` untuk dialog); invalidate di `onSuccess` setiap mutation; pagination `placeholderData: keepPreviousData`.
- Tanpa `any` di boundary API, tanpa `@ts-ignore`.
- Komponen presentasional + props via `interface`; `cn()` tidak diperlukan dalam file ini (tidak ada className override).
- Tanpa import lintas fitur di komponen (hanya `components/ui`, `lib`, `i18n`); form map 422 via `mapApiFieldErrors` dari `@/lib/field-errors` → `form.setError` per-field (`useEffect` + `isValidationError` guard) + `<FormMessage/>` kosong tiap field — error global/banner hanya non-422. Satu-satunya pengecualian terdokumentasi adalah type `Permission` dari `@/features/permission/types` (lihat §3).
- Bahasa UI: Indonesia.

## 6. Container (src/app/routes/roles.tsx)

- Memakai `useRoles({ page, limit, search, sortBy, sortOrder })` (pagination 10/page + search + sort), `useCreateRole`, `useUpdateRole`, `useDeleteRole`, `usePermissions()`, `useRolePermissions(editingRole?.id)`, `useReplaceRolePermissions()`.
- Error delete `ApiError` 409 → pesan ramah "Role masih dipakai user, tidak bisa dihapus"; selain itu tampilkan `.message`.
- Dialog state lokal: `formOpen`, `formMode`, `editingRole`, `deletingRole`, `permissionError`.

### Alur pengelolaan permission

- **Create**: `POST /roles` sukses → jika `permissionIds` kosong, tutup dialog; jika tidak → `PUT /roles/:id/permissions` lalu tutup. Gagal di langkah PUT → drawer bentuk partial-failure banner "Role berhasil dibuat, tetapi gagal mengatur permissions." (pola banner `roleError` di `users.tsx`, tombol Tutup).
- **Edit**: bandingkan id permission awal (dari `GET /roles/:id/permissions`) dengan pilihan baru via signature `[...ids].sort().join(',')`:
  - tidak berubah → hanya `PATCH /roles/:id`, tutup.
  - berubah (termasuk jadi kosong) → `PATCH` lalu `PUT /roles/:id/permissions` (`[]` untuk clear semua). Gagal di PUT → banner partial-failure "Role berhasil diperbarui, tetapi gagal mengatur permissions."
- **Full-replace semantics**: PUT adalah set penuh, bukan delta; kosong = clear semua.
- **Gating dialog**: `<RoleFormDialog>` hanya di-render saat data inisialisasi siap — create butuh `permissionsQuery.isSuccess`; edit butuh `permissionsQuery.isSuccess && rolePermissionsQuery.isSuccess`. Ini mencegah dialog terbuka dengan `initialPermissionIds` yang salah (delay sesaat saat edit diperbolehkan). Karena gating ini, state `initialPermissionIds` selalu final saat dialog-mount → remount-on-open (render hanya saat `formOpen`) tetap aman.
- `isPending` dialog = create/update **atau** replaceRolePermissions sedang pending. `submissionError` dari create/update saja.
- `permissionError` (partial-failure) ditampilkan sebagai banner `role="alert"` di atas tabel.

## 7. Status & Catatan

- **Status**: ✅ Selesai — CRUD + manajemen permission + pagination + search bar + sortable semua kolom + permission gating (route, tombol, menu), lint + tsc bersih.
- **Search & sort (rules List CRUD)**:
  - Search bar (`SearchBar` shared, placeholder "Cari nama atau deskripsi...") → debounce 400ms → `GET /roles?search=` (OR like `name,description`); ubah search/sort → reset `page=1`.
  - Sortable semua kolom tampil: `Nama(name)`, `Deskripsi(description)`, `Dibuat(createdAt)` via `SortableHeader` (cycle asc→desc→null); pagination via `DataTablePagination` (10/page).
- **Tanggal & Waktu**: kolom Dibuat memakai `formatDateTime` dari `@/lib/datetime` (tanggal+jam, zona client, locale browser); kirim filter tanggal sebagai ISO UTC, contoh `filter[createdAt][gte]=2026-01-01T00:00:00.000Z`.
- `textarea` dan `checkbox` (shadcn/ui) ditambahkan via CLI.
- Cross-feature import `Permission` dari `features/permission` masuk ke `role-form-dialog.tsx` — pengecualian disengaja (permission options adalah data dependency dialog); bagian lain dialog tetap presentasional.
- Catatan: role-form-dialog membaca state `form.control` via `useForm` — safe karena dialog di-render hanya saat data init siap (`dialogReady`), jadi `defaultValues`/`initialPermissionIds` final saat mount dengan `role` yang benar.

## 8. Permissions

| Route / Aksi | Kode dibutuhkan |
| --- | --- |
| Route `/` (dashboard home) | LOGIN-only via `ProtectedRoute` (tanpa kode permission) |
| Route `/roles` (lihat daftar) | `role:read` → tanpa akses ke `/403` |
| Tombol "Tambah Role" | `role:create` |
| Aksi Edit di tabel (`RoleTable` prop `canUpdate`) | `role:update` |
| Aksi Hapus di tabel (`RoleTable` prop `canDelete`) | `role:delete` |
| Checkbox permission di dialog + `PUT /roles/:id/permissions` (create & update) | `permission:update` → tanpa izin: checkbox + Pilih/Hapus semua di-disable + hint `role:form.permissionsNoPermission`, PUT tidak dipanggil (nama/deskripsi tetap tersimpan) |
| Daftar permission di dialog (`GET /permissions`) | `permission:read` → 403 tampil banner `role:errors.permissionsForbidden` |
| Simpan permission role (`PUT /roles/:id/permissions`) | `permission:update` |
| Menu sidebar "Roles" | `role:read` (disembunyikan bila tak punya) |

- Gate route via `<RequirePermission code="role:read">` di `src/app/routes/index.tsx`; gate tombol via `can('role:create')` dari `useAuthPermissions()`; kolom Aksi hilang bila `canUpdate` dan `canDelete` keduanya `false`.
- Error `ApiError` 403 pada list (`isForbiddenError`) → empty-state "Tidak punya akses …" (`role:errors.forbidden`), dibedakan dari 401 (redirect login di `lib/api-client.ts`); query global tidak retry 403 (`lib/query-client.ts`).
- Helper: `hasPermission(user, code)` / `hasAnyPermission(user, codes)` di `src/features/auth/lib/permissions.ts` (aman untuk `user === null` / tanpa role → `[]`).
- Contoh:
  ```tsx
  import { RequirePermission } from '@/components/shared/require-permission';

  // Route butuh role:read, tanpa akses → /403
  <RequirePermission code="role:read"><RolesPage /></RequirePermission>

  // Tombol butuh salah satu — disembunyikan bila tak punya
  <RequirePermission anyOf={['role:update', 'role:delete']} fallback={null}>
    <RoleActions />
  </RequirePermission>
  ```

## 9. Toast Feedback

- Key sukses/gagal: `role:toast.created/updated/deleted` + `role:toast.createFailed/updateFailed/deleteFailed` (via `t()`, tanpa hardcode).
- Helper `@/lib/toast`: `toastSuccess` di `onSuccess`, `toastError(getApiErrorMessage(err, t('role:toast.*Failed')))` di `onError`. `<Toaster/>` mount sekali di `src/app/providers.tsx`.
- Alur sukses: create/update/delete → tutup dialog → `toastSuccess` (contoh: tambah role → `role:toast.created`).
- Alur gagal: validasi 422 tampil per-field via `form.setError` **tanpa toast** (`if (isValidationError(err)) return;`, dialog tetap terbuka); delete 409 ("masih dipakai user") → `toastError` pesan ramah; 401/403 ikut alur `ApiError` existing (redirect/gate), tanpa toast sukses.
- Mutasi sekunder `replaceRolePermissions` (`PUT /roles/:id/permissions`): toast sendiri — sukses ikut toast utama create/update; gagal walau dialog sudah tertutup → `toastError` + banner `role:errors.permissionAssignCreated/permissionAssignUpdated` (state `permissionErrorKind`, tombol Tutup). Tanpa izin `permission:update`, PUT tidak dipanggil.