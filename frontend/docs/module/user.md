# Module: User — Brief

Dokumen ini mencatat rencana desain/implementasi halaman **Users** pada frontend React — CRUD lengkap akun pengguna (list paginated, create, update, delete, assign role). Mengikuti konvensi `AGENTS.md` frontend dan format brief `docs/module/dashboard.md`.

## 1. Tujuan & Ruang Lingkup

- Menyediakan **CRUD akun user** untuk admin: lihat daftar user (pagination), tambah, edit profile/status/password, assign role, dan hapus.
- Konsumsi API `backend/` modul user (`backend/docs/modules/user.md`) — prefix global `/api/v1`, endpoint butuh JWT Bearer.
- Data **role** (dropdown assign) diambil dari endpoint `/roles` melalui feature terpisah `features/role/`.

## 2. Routing

- Route sudah ada di `src/app/routes/index.tsx`: `/users` (nested di bawah `/` **protected**, dashboard di root).
- Container page: `src/app/routes/users.tsx` (`UsersPage`).

```
/users  → halaman CRUD Users
```

## 3. Struktur File

```
src/app/routes/users.tsx                  # container: state page, mutation handlers, dialog state

src/features/user/
├── types.ts                              # UserStatus, User, CreateUserInput, UpdateUserInput, RoleOption
├── api/users-api.ts                      # listUsers, createUser, updateUser, deleteUser, assignRole
├── hooks/
│   ├── use-users.ts                      # query ['users', {page, limit}], keepPreviousData
│   ├── use-create-user.ts                # mutation createUser → invalidate ['users']
│   ├── use-update-user.ts                # mutation updateUser → invalidate ['users']
│   ├── use-delete-user.ts                # mutation deleteUser → invalidate ['users']
│   └── use-assign-role.ts                # mutation assignRole → invalidate ['users']
└── components/
    ├── user-table.tsx                    # presentational table + DropdownMenu (Edit/Hapus)
    ├── user-form-dialog.tsx              # Dialog form create/edit (rhf + zod), select role edit-mode
    └── delete-user-dialog.tsx            # AlertDialog konfirmasi hapus

src/features/role/                        # feature minimal untuk dropdown roles
├── types.ts                              # Role (id + name wajib)
├── api/roles-api.ts                      # listRoles → requestList
└── hooks/use-roles.ts                    # query ['roles'], staleTime ≥ 60s
```

## 4. Komponen yang Ditambah (via CLI)

Via `pnpm dlx shadcn@latest add table dialog select badge alert-dialog` dari `frontend/`. `button`, `form`, `input`, `label`, `dropdown-menu`, `skeleton` sudah tersedia.

Larang edit manual `src/components/ui/` (AGENTS.md & DESIGN_SYSTEM.md).

## 5. Kontrak API (backend `backend/docs/modules/user.md`)

Envelope: sukses `{ data, message }`; list `{ data: items, meta: {page, limit, total}, message }`; error `{ statusCode, message, errors }`. Semua endpoint user butuh permission → JWT Bearer (`Authorization` di-attach otomatis di `lib/api-client.ts` dari `localStorage['auth.token']`).

| Endpoint | Body | Keterangan |
| --- | --- | --- |
| `POST /users` | `{ email, fullName, password, status? }` | 201; 409 email duplikat; 422 validasi. |
| `GET /users?page=&limit=` | — | list paginated, limit default 20 max 100. |
| `GET /users?search=&sortBy=&sortOrder=` | `search` OR like `fullName,email`; `sortBy` ∈ `fullName,email,status,roleName,createdAt,updatedAt` | search <2 char diabaikan; sort klik header; default `createdAt desc`. |
| `GET /users/:id` | — | detail (tidak dipakai halaman ini — pakai data list). |
| `PATCH /users/:id` | `{ email?, fullName?, status?, password? }` | semua opsional; `password` kosong di form = tidak dikirim. |
| `PATCH /users/:id/role` | `{ roleId }` | assign role; dipanggil terpisah dari `updateUser`. |
| `DELETE /users/:id` | — | hapus user. |
| `GET /roles?page=&limit=` | — | list role untuk dropdown assign. |

UserEntity: `{ id, email, fullName, status: 'ACTIVE'|'INACTIVE'|'BLOCKED', roleId, role: {id,name}\|null, createdAt, updatedAt }`.

## 6. Konvensi (AGENTS.md)

- Query key per domain: `['users', { page, limit, search, sortBy, sortOrder }]`, `['roles', { page, limit }]`; pagination pakai `placeholderData: keepPreviousData`.
- Mutation invalidate `['users']` di `onSuccess`; efek samping UI (tutup dialog) ditangani di container via `onSuccess` mutation.
- Komponen **presentational**: data via props, tanpa fetch; props `interface`, tanpa `any`, pakai `cn()`.
- Larang import lintas fitur: `features/user/` **tidak** mengimpor `features/role/` — data role masuk via props `RoleOption[]` dari container. `mapApiFieldErrors` diimpor dari `@/lib/field-errors` (helper shared; `features/auth/lib/field-errors` hanya re-export kompatibilitas).
- Error: `ApiError` — `statusCode 422` → `useEffect` map `mapApiFieldErrors(err)` → `form.setError` per-field + `<FormMessage/>` kosong tiap field; banner di atas form **hanya non-422** (409/500). `onError` di route wajib `if (isValidationError(err)) return;` (tanpa toast, dialog tetap terbuka).

## 7. Status & Catatan

- **Selesai**: CRUD lengkap + assign role + pagination + loading skeleton + error state + search bar + sortable semua kolom + permission gating (route, tombol, menu).
- **Search & sort (rules List CRUD)**:
  - Search bar (`SearchBar` shared, placeholder "Cari nama atau email...") → debounce 400ms → `GET /users?search=` (OR like `fullName,email`); <2 char diabaikan; ubah search → reset `page=1`; empty state "Tidak ditemukan untuk ..." + Reset.
  - Sortable semua kolom tampil: `Nama(fullName)`, `Email(email)`, `Status(status)`, `Role(roleName→role.name)`, `Dibuat(createdAt)` via `SortableHeader` (cycle asc→desc→null); queryKey `['users', {page,limit,search,sortBy,sortOrder}]`.
- **Tanggal & Waktu**: kolom Dibuat memakai `formatDateTime` dari `@/lib/datetime` (tanggal+jam, zona client, locale browser); kirim filter tanggal sebagai ISO UTC, contoh `filter[createdAt][gte]=2026-01-01T00:00:00.000Z`.
- **Catatan implementasi**:
  - `requestList<T>` helper baru di `lib/api-client.ts` mengubah `{ data, meta }` jadi `{ items, page, limit, total }`.
  - Bearer token: `Authorization` di-attach pada **semua** request di `lib/api-client.ts` (aman untuk authApi public — token tidak ada sebelum login).
  - Dialog form & confirm hapus di-render **kondisional** dari container (unmount saat tutup), sehingga `defaultValues` react-hook-form dihitung sekali saat mount tanpa `useEffect` reset.
  - Select role memakai sentinel `'none'` untuk "Tanpa role" (Radix Select tidak menerima nilai kosong); melepas role (roleId kosong) tidak dikirim ke `role` endpoint karena backend belum mendukung null per `UpdateUserRoleDto`.

## 8. Permissions

| Route / Aksi | Kode dibutuhkan |
| --- | --- |
| Route `/` (dashboard home) | LOGIN-only via `ProtectedRoute` (tanpa kode permission) |
| Route `/users` (lihat daftar) | `user:read` → tanpa akses ke `/403` |
| Tombol "Tambah User" | `user:create` |
| Aksi Edit di tabel (`UserTable` prop `canUpdate`) | `user:update` |
| Aksi Hapus di tabel (`UserTable` prop `canDelete`) | `user:delete` |
| Select role di form + `PATCH /users/:id/role` (create & update) | `user:update` → tanpa izin: select di-disable + hint `user:form.roleNoPermission`, `assignRole` tidak dipanggil |
| Dropdown role di form (`GET /roles`) | `role:read` (gagal → banner `user:errors.loadRoles`, halaman tetap jalan) |
| Menu sidebar "Users" | `user:read` (disembunyikan bila tak punya) |

- Gate route via `<RequirePermission code="user:read">` di `src/app/routes/index.tsx`; gate tombol via `can('user:create')` dari `useAuthPermissions()`; kolom Aksi hilang bila `canUpdate` dan `canDelete` keduanya `false`.
- Error `ApiError` 403 pada list (`isForbiddenError`) → empty-state "Tidak punya akses …" (`user:errors.forbidden`), dibedakan dari 401 (redirect login di `lib/api-client.ts`); query global tidak retry 403 (`lib/query-client.ts`).
- Helper: `hasPermission(user, code)` / `hasAnyPermission(user, codes)` di `src/features/auth/lib/permissions.ts` (aman untuk `user === null` / tanpa role → `[]`).
- Contoh:
  ```tsx
  import { useAuthPermissions } from '@/features/auth/hooks/use-permissions';
  import { Can } from '@/components/shared/require-permission';

  const { can } = useAuthPermissions();
  if (can('user:create')) { /* tampilkan tombol tambah */ }

  <Can code="user:delete" fallback={null}>
    <Button>Hapus</Button>
  </Can>
  ```

## 9. Toast Feedback

- Key sukses/gagal: `user:toast.created/updated/deleted` + `user:toast.createFailed/updateFailed/deleteFailed` (via `t()`, tanpa hardcode).
- Helper `@/lib/toast`: `toastSuccess` di `onSuccess`, `toastError(getApiErrorMessage(err, t('user:toast.*Failed')))` di `onError`. `<Toaster/>` mount sekali di `src/app/providers.tsx`.
- Alur sukses: create/update/delete → tutup dialog → `toastSuccess` (contoh: tambah user → `user:toast.created`).
- Alur gagal: validasi 422 tampil per-field via `form.setError` **tanpa toast** (`if (isValidationError(err)) return;`, dialog tetap terbuka); non-422 → `toastError` + banner; 401/403 ikut alur `ApiError` existing (redirect/gate), tanpa toast sukses.
- Mutasi sekunder `assignRole` (`PATCH /users/:id/role`): toast sendiri — sukses ikut toast utama create/update; gagal walau dialog sudah tertutup → `toastError` + banner `user:errors.roleAssignCreated/roleAssignUpdated` (state `roleErrorKind`, tombol Tutup).