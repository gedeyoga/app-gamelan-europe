# RBAC — Role Based Access Control (Spec)

Menu: [user.md](./user.md) · [role.md](./role.md) · [permission.md](./permission.md) · [role-permissions.md](./role-permissions.md) · [api-key.md](./api-key.md)

---

## 1. Overview

Modul RBAC menyediakan dua kemampuan inti backend:

1. **Autentikasi (Auth)** — registrasi & login user, menerbitkan JWT.
2. **Otorisasi (Authorization)** — pembatasan akses endpoint berdasarkan role dan permission user.

Model domain (final, sudah dikonfirmasi user):

| Relasi | Keterangan |
| --- | --- |
| `user` 1 : N `role` | Satu user memiliki max satu role (FK `role_id` di `users`). |
| `role` N : M `permission` | Melalui tabel join `role_permissions`. |
| `permission` | Memiliki `code` unik berkonvensi `resource:action`. |

Prinsip:

- Satu user → satu role → banyak permission.
- Akses ditentukan oleh `permission.code` (`resource:action`) yang cocok dengan dekorator endpoint.
- Sumber kebenaran tunggal (single source of truth): role/permission selalu di-load **fresh dari DB** setiap request (lihat [Authorization](#6-authorization)).

---

## 2. ERD

```mermaid
erDiagram
    User ||--o{ Role : "role_id"
    Role ||--o{ RolePermission : owns
    Permission ||--o{ RolePermission : included
    User {
        string id PK
        string email UK
        string fullName
        string passwordHash
        enum status
        string roleId FK
    }
    Role {
        string id PK
        string name UK
        string description
    }
    Permission {
        string id PK
        string code UK
        string description
    }
    RolePermission {
        string roleId PK, FK
        string permissionId PK, FK
    }
```

Versi teks:

```
User 1 ── N Role  N ── M Permission
 │                 │
 │ role_id         └── Tabel join: role_permissions (role_id, permission_id)
```

---

## 3. Model Prisma (lengkap)

Lokasi sumber: `libs/prisma/schema.prisma` (satu-satunya sumber entity, lihat RULES bab 4).

```prisma
model User {
  id           String     @id @default(uuid())
  email        String     @unique
  fullName     String     @map("full_name")
  passwordHash String     @map("password_hash")
  status       UserStatus @default(ACTIVE)
  roleId       String?    @map("role_id")
  role         Role?      @relation(fields: [roleId], references: [id])
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  @@map("users")
}

enum UserStatus {
  ACTIVE
  INACTIVE
  BLOCKED
}

model Role {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  permissions RolePermission[]
  users       User[]
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  @@map("roles")
}

model Permission {
  id          String           @id @default(uuid())
  code        String           @unique
  description String?
  roles       RolePermission[]
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")

  @@map("permissions")
}

model RolePermission {
  roleId       String     @map("role_id")
  permissionId String     @map("permission_id")
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now()) @map("created_at")

  @@id([roleId, permissionId])
  @@map("role_permissions")
}
```

Catatan konsistensi relasi:

- `RolePermission.permission` adalah **backfield** dari `Permission.roles`.
- `RolePermission.role` adalah **backfield** dari `Role.permissions`.
- `User.role` adalah backfield dari `Role.users`.
- `onDelete: Cascade` pada `RolePermission`: menghapus role/permission otomatis menghapus baris join-nya. `users.role_id` **tidak** memakai cascade — penghapusan role yang masih dipakai user ditolak di service (lihat keputusan di [role.md](./role.md#2-model-prisma)).

---

## 4. Konvensi Permission Code

Format: **lowercase** `resource:action`.

| Resource | Action | Code |
| --- | --- | --- |
| user | create | `user:create` |
| user | read | `user:read` |
| user | update | `user:update` |
| user | delete | `user:delete` |
| role | create | `role:create` |
| role | read | `role:read` |
| role | update | `role:update` |
| role | delete | `role:delete` |
| permission | create | `permission:create` |
| permission | read | `permission:read` |
| permission | update | `permission:update` |
| permission | delete | `permission:delete` |
| organization | create | `organization:create` |
| organization | read | `organization:read` |
| organization | update | `organization:update` |
| organization | delete | `organization:delete` |
| apikey | create | `apikey:create` |
| apikey | read | `apikey:read` |
| apikey | update | `apikey:update` |
| apikey | delete | `apikey:delete` |
| admin | access | `admin:access` (khusus gerbang manajemen user/role) |

Selain CRUD, resource konten (`story`, `event`) memakai `action` tambahan berupa transisi workflow: `submit` (DRAFT→REQUEST), `approve` (REQUEST→PUBLISHED), `reject` (REQUEST→DRAFT), `publish` (APPROVED→PUBLISHED), `unpublish` (PUBLISHED→DRAFT) → mis. `story:submit`, `event:publish` (lihat [story.md §6](./story.md#action--transisi) & [event.md §7](./event.md#7-tabel-endpoint--permission)).

Aturan:

- Selalu lowercase, `:` pemisah `resource` dan `action`.
- `resource` = domain (tunggal), `action` ∈ `create | read | update | delete` (+ action workflow konten).
- Resource lain di luar RBAC (mis. `payment`, `order`) mengikuti pola yang sama saat ditambahkan.

---

## 5. Auth Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as API (Apps/App)
    participant DB as Database

    C->>API: POST /api/v1/auth/register {email, fullName, password}
    API->>API: Hash password (argon2id)
    API->>DB: INSERT user (roleId null)
    API-->>C: 201 {data: <user tanpa password_hash>, message}

    C->>API: POST /api/v1/auth/login {email, password}
    API->>DB: SELECT user by email
    API->>API: Verify password (argon2id)
    API->>API: Sign JWT { sub, email } via JWT_SECRET
    API-->>C: 200 {data: {accessToken, refreshToken, user}, message}

    C->>API: GET /api/v1/users (Authorization: Bearer <token>)
    API->>API: Verify JWT -> load role+permissions fresh
    API-->>C: 200 {data: [user], message}
```

Detail:

- **Password**: di-hash dengan **argon2id** (mis. `@node-rs/argon2`) saat register. `passwordHash` tidak pernah diekspos keluar API (select selalu menyembunyikan kolom ini — lihat [user.md](./user.md#3-entity-payload-type)).
- **JWT**: sign dengan `JWT_SECRET` (dari `@nestjs/config`, via env — RULES bab 8). Payload `{ sub: userId, email }`, expiry dari `JWT_EXPIRES_IN`.
- **Refresh token**: mekanisme lengkap (rotasi, logout, blacklist Redis) di **[`auth.md`](./auth.md)**. Login mengembalikan `{ accessToken, refreshToken, user }`.

---

## 6. Authorization (deny-by-default)

Mekanisme kerja (global guard: `JwtAuthGuard` lalu `PermissionsGuard` via `APP_GUARD` — detail di RULES Bab 21):

```
JWT valid? (JwtAuthGuard global)
  ├─ @Public() → lolos penuh (tanpa JWT)
  ├─ NO  → 401 Unauthorized
  └─ YES → PermissionsGuard:
              ├─ @Permissions(...) cocok (fresh dari DB) → allow
              ├─ @Permissions(...) tak cocok → 403 Forbidden
              ├─ tanpa metadata + ada user → allow sebagai LOGIN-only
              │   (hanya POST /auth/logout & GET /auth/me yang sah)
              └─ tanpa metadata + tanpa user → 403 + Logger.warn (bug: dekorator lupa)
```

Komponen:

1. **`JwtAuthGuard`** (global, pertama) — memverifikasi JWT di header `Authorization: Bearer <token>` + cek blacklist Redis `jwt:blacklist:<jti>`. JWT tidak valid / expired / tidak ada → `401 Unauthorized`. `@Public()` mem-bypass guard ini.
2. **`@Public()`** — metadata `IS_PUBLIC_KEY`; dipakai endpoint publik (lihat daftar pengecualian di bawah).
3. **`@Permissions('user:read', ...)`** — dekorator metadata `PERMISSIONS_KEY`; permission yang dibutuhkan endpoint.
4. **`PermissionsGuard`** (global, kedua, deny-by-default) — mengecek `IS_PUBLIC_KEY` dulu, lalu `PERMISSIONS_KEY`; memuat user + role + daftar `permission.code` **fresh dari DB** (bukan dari klaim JWT) via `PermissionService.getPermissionCodesByUserId` lalu mencocokkan minimal satu code.

```typescript
// Struktur aktual PermissionsGuard (deny-by-default) — RULES Bab 21e
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService, // load fresh dari DB
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. PUBLIC → lolos penuh.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Ambil metadata permission endpoint.
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context.switchToHttp().getRequest();

    // 3. Deny-by-default: tanpa metadata = dekorator lupa → warn.
    //    Ada user → LOGIN-only (hanya logout/me yang sah); tanpa user → 403.
    if (!required || required.length === 0) {
      this.logger.warn(
        `Missing @Permissions metadata on ${context.getClass().name}.${context.getHandler().name} — Permission required`,
      );
      if (!user?.id) throw new ForbiddenException('Permission required');
      return true;
    }

    // 4. Metadata ada tapi tanpa user → 401.
    if (!user?.id) throw new UnauthorizedException('Unauthorized');

    // 5. Load fresh dari DB, cocokkan minimal satu code.
    const codes = await this.permissionService.getPermissionCodesByUserId(user.id);
    const allowed = required.some((code) => codes.includes(code));
    if (!allowed) throw new ForbiddenException('Forbidden resource');
    return true;
  }
}
```

Aturan urutan:

- `@Public()` → lolos kedua guard (tanpa JWT).
- JWT invalid / expired / blacklisted → **401** (JwtAuthGuard, didahulukan).
- JWT valid tapi permission kurang → **403** (PermissionsGuard).
- Tanpa metadata + ada user terautentikasi → lolos sebagai **LOGIN-only** — hanya sah untuk `POST /api/v1/auth/logout` dan `GET /api/v1/auth/me`.
- Tanpa metadata + tanpa user → **403** `ForbiddenException('Permission required')` + `Logger.warn` → **dianggap bug** (dekorator lupa), bukan alur normal. Larang mengandalkan pola ini untuk endpoint baru.

### Daftar pengecualian resmi

**PUBLIC** (`@Public()`):

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/api/v1/health` | Health check. |
| POST | `/api/v1/auth/register` | Registrasi mandiri. |
| POST | `/api/v1/auth/login` | Login, terbit JWT. |
| POST | `/api/v1/auth/refresh` | Rotasi refresh token. |

**LOGIN-only** (tanpa dekorator, lolos karena `request.user` ada):

| Method | Path | Keterangan |
| --- | --- | --- |
| POST | `/api/v1/auth/logout` | Blacklist access + revoke refresh. |
| GET | `/api/v1/auth/me` | Profil user + role + permissions. |

Selain tabel di atas, **semua** endpoint users/roles/permissions **wajib** `@Permissions(...)` (lihat §8). Detail prinsip 401 vs 403 + konvensi `resource:action` ada di RULES Bab 21.

### Single source of truth (RULES bab 4)

Role & permission diambil **fresh** dari DB setiap request, bukan dari klaim JWT. Konsekuensi:

- Role baru / permission baru langsung berlaku tanpa user login ulang.
- Role dihapus/diubah → akses langsung menyesuaikan.
- Trade-off: 1 query ekstra per request — bisa dioptimalkan (lihat cache di bawah).

### Opsional: cache Redis (RULES bab 17)

Optimasi opsional untuk memangkas query per request:

| Aspek | Nilai |
| --- | --- |
| Key | `perm:user:<id>` |
| Value | `string[]` (`permission.code` milik user) |
| TTL | eksplisit, mis. 300 detik |
| Invalidasi | `del` saat mutasi role/permission/relasi role-permission |
| Larang | jangan cache payload sensitif (tidak ada di sini — hanya kode permission) |

Pola `cache miss → query DB → simpan → return`, error Redis diabaikan dan fallback ke DB (tidak lempar ke client, RULES bab 17).

```typescript
const key = `perm:user:${userId}`;
const cached = await this.cache.get<string[]>(key);
if (cached) return cached;
const codes = await this.permissionRepository.findCodesByUserId(userId);
await this.cache.set(key, codes, 300);
return codes;
```

---

## 7. Seed Default

Lokasi tunggal: `libs/prisma/seed.ts` (sumber deklaratif `DEFAULT_PERMISSIONS` / `DEFAULT_ROLES`, aturan lengkap di RULES Bab 22). Seed bersifat idempoten (aman diulang) dan additive.

| Konstanta | Isi |
| --- | --- |
| `DEFAULT_PERMISSIONS` | Array `{ code, description }` — 71 code: RBAC 12 (`user/role/permission` × `create/read/update/delete`), `story:*` 9, `category:*` 4, `event:*` 9, `event-type:*` 2 (`create,read`), `organization:*` 4, `subscription:*` 4, `billing:*` 4, `apikey:*` 4, `archive:*` 9, `event-submission:*` 3 (`read,approve,reject`), `archive-submission:*` 3 (`read,approve,reject`), `story-submission:*` 3 (`read,approve,reject`), `admin:access` 1 (**khusus gerbang manajemen user/role; hanya `admin`**). Format lowercase `resource:action`. |
| `DEFAULT_ROLES` | Array `{ name, description, permissions: string[] }` — 3 role: `admin` (semua code), `organization` (`story:read`; event create·read·update·delete + `event:submit`; archive create·read·update·delete + `archive:submit`; `event-type:read`, `category:read`, `user:create`, `user:read` — **tanpa story write**), `member` (`story:read`, `event:read`, `event:create`, `event:update`, `event:submit`, `event-type:read`, `category:read`, `archive:read`, `archive:create`, `archive:update`, `archive:submit` — tanpa story write). Struktur array siap tambah role baru. |
| User admin | Dari env `ADMIN_EMAIL` / `ADMIN_FULL_NAME` / `ADMIN_PASSWORD` → role `admin`, status `ACTIVE`. |

### Matriks role → permission

71 permission dibagi ke 3 role. `admin` = seluruh 71 code; `organization` = 15 code; `member` = 11 code.

| Resource | Code | admin | organization | member |
| --- | --- | :---: | :---: | :---: |
| user | `user:create` | ✅ | ✅ | — |
| user | `user:read` | ✅ | ✅ | — |
| user | `user:update` | ✅ | — | — |
| user | `user:delete` | ✅ | — | — |
| role | `role:create/read/update/delete` (4) | ✅ | — | — |
| permission | `permission:create/read/update/delete` (4) | ✅ | — | — |
| story | `story:create` | ✅ | — | — |
| story | `story:read` | ✅ | ✅ | ✅ |
| story | `story:update` | ✅ | — | — |
| story | `story:delete` | ✅ | — | — |
| story | `story:submit` | ✅ | — | — |
| story | `story:approve` | ✅ | — | — |
| story | `story:reject` | ✅ | — | — |
| story | `story:publish` | ✅ | — | — |
| story | `story:unpublish` | ✅ | — | — |
| event | `event:create` | ✅ | ✅ | ✅ |
| event | `event:read` | ✅ | ✅ | ✅ |
| event | `event:update` | ✅ | ✅ | ✅ |
| event | `event:delete` | ✅ | ✅ | — |
| event | `event:submit` | ✅ | ✅ | ✅ |
| event | `event:approve` | ✅ | — | — |
| event | `event:reject` | ✅ | — | — |
| event | `event:publish` | ✅ | — | — |
| event | `event:unpublish` | ✅ | — | — |
| event-type | `event-type:create` | ✅ | — | — |
| event-type | `event-type:read` | ✅ | ✅ | ✅ |
| category | `category:create` | ✅ | — | — |
| category | `category:read` | ✅ | ✅ | ✅ |
| category | `category:update` | ✅ | — | — |
| category | `category:delete` | ✅ | — | — |
| organization | `organization:create/read/update/delete` (4) | ✅ | — | — |
| subscription | `subscription:create/read/update/delete` (4) | ✅ | — | — |
| billing | `billing:create/read/update/delete` (4) | ✅ | — | — |
| apikey | `apikey:create/read/update/delete` (4) | ✅ | — | — |
| archive | `archive:create` | ✅ | ✅ | ✅ |
| archive | `archive:read` | ✅ | ✅ | ✅ |
| archive | `archive:update` | ✅ | ✅ | ✅ |
| archive | `archive:delete` | ✅ | ✅ | — |
| archive | `archive:submit` | ✅ | ✅ | ✅ |
| archive | `archive:approve` | ✅ | — | — |
| archive | `archive:reject` | ✅ | — | — |
| archive | `archive:publish` | ✅ | — | — |
| archive | `archive:unpublish` | ✅ | — | — |
| event-submission | `event-submission:read` | ✅ | — | — |
| event-submission | `event-submission:approve` | ✅ | — | — |
| event-submission | `event-submission:reject` | ✅ | — | — |
| archive-submission | `archive-submission:read` | ✅ | — | — |
| archive-submission | `archive-submission:approve` | ✅ | — | — |
| archive-submission | `archive-submission:reject` | ✅ | — | — |
| story-submission | `story-submission:read` | ✅ | — | — |
| story-submission | `story-submission:approve` | ✅ | — | — |
| story-submission | `story-submission:reject` | ✅ | — | — |
| admin | `admin:access` | ✅ | — | — |

> `organization` & `member` **tidak** boleh approve/reject/publish/unpublish — transisi maksimal sampai `REQUEST` (`submit`). Keduanya **tidak** punya story write. Row-level scoping (konten milik organisasi/creator) dijelaskan di [§10](#10-row-level-scoping).


```typescript
// libs/prisma/seed.ts (ringkas) — deklaratif + upsert dalam satu $transaction
const DEFAULT_PERMISSIONS = [
  { code: 'user:create', description: 'Membuat user baru' },
  // ... 71 code: RBAC 12 + story 9 + category 4 + event 9 + event-type 2 + organization 4 + subscription 4 + billing 4 + apikey 4 + archive 9 + event-submission 3 + archive-submission 3 + story-submission 3 + admin:access 1
];

const DEFAULT_ROLES = [
  { name: 'admin', description: 'Admin dengan akses penuh RBAC',
    permissions: DEFAULT_PERMISSIONS.map((p) => p.code) },
  { name: 'organization', description: 'Pengelola event milik anggota organisasinya (tanpa story write)',
    permissions: ['story:read',
      'event:create', 'event:read', 'event:update', 'event:delete', 'event:submit',
      'event-type:read', 'category:read',
      'archive:create', 'archive:read', 'archive:update', 'archive:delete', 'archive:submit',
      'user:create', 'user:read'] },
  { name: 'member', description: 'Anggota organisasi — mengelola event (sampai REQUEST), tanpa story write',
    permissions: ['story:read', 'event:read', 'event:create', 'event:update', 'event:submit', 'event-type:read', 'category:read',
      'archive:read', 'archive:create', 'archive:update', 'archive:submit'] },
];

// Targeted delete (bukan deleteMany global): copot story-write dari role `organization` saja.
const ORGANIZATION_REMOVED_PERMISSION_CODES = ['story:create', 'story:update', 'story:delete', 'story:submit'];

await prisma.$transaction(async (tx) => {
  for (const perm of DEFAULT_PERMISSIONS) {
    await tx.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: { code: perm.code, description: perm.description },
    });
  }

  for (const role of DEFAULT_ROLES) {
    await tx.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
  }

  // ADDITIVE: hanya tambah yang kurang.
  for (const role of DEFAULT_ROLES) {
    for (const code of role.permissions) {
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  // Targeted delete: hapus story-write dari role `organization` saja (custom role aman).
  await tx.rolePermission.deleteMany({
    where: {
      roleId: roleIdByName.get('organization'),
      permission: { code: { in: ORGANIZATION_REMOVED_PERMISSION_CODES } },
    },
  });

  // Password selalu di-reset dari env (re-hash argon2id) tiap re-seed.
  await tx.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { fullName: ADMIN_FULL_NAME, passwordHash, roleId: adminRoleId },
    create: { email: ADMIN_EMAIL, fullName: ADMIN_FULL_NAME, passwordHash, roleId: adminRoleId, status: 'ACTIVE' },
  });
});
```

Jalankan:

```bash
pnpm prisma:seed
```

Catatan:

- **Idempoten**: seed 2x tidak `P2002`; `description` ikut ter-update via `upsert`.
- **Additive**: permission baru yang ditambah ke `DEFAULT_PERMISSIONS` + `permissions` role otomatis ter-link ke role terkait tanpa menghapus relasi lama.
- **Targeted delete**: `ORGANIZATION_REMOVED_PERMISSION_CODES` (`story:create/update/delete/submit`) di-`deleteMany` hanya untuk role `organization` → penghapusan benar-benar berlaku tanpa menghapus relasi custom role (`story:read` tetap).
- **`admin:access`**: hanya `admin` (dari `DEFAULT_PERMISSIONS.map`). Gerbang `user.service` list/create/update/delete/assignRole; bukan permission konten.
- **Reset password**: tiap re-seed me-re-hash `ADMIN_PASSWORD` (argon2id) dan meng-update `passwordHash` user admin. Secret hanya dari env, tidak di-commit dan tidak di-log.

---

## 8. Ringkasan Endpoint

Semua path memakai prefix **`/api/v1`**. Semua respon sukses `{ data, message }`, error `{ statusCode, message, errors }` (RULES bab 5). Otorisasi deny-by-default (RULES Bab 21 + §6): setiap endpoint wajib `@Public()` | `@Permissions(...)` | LOGIN-only (hanya logout/me).

### Health

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | Health check | PUBLIC (`@Public()`) |

### Auth (sinkron dengan [auth.md](./auth.md#7-endpoint) & [user.md](./user.md#7-endpoint))

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | Registrasi user baru | PUBLIC (`@Public()`) |
| POST | `/api/v1/auth/login` | Login, menerbitkan JWT | PUBLIC (`@Public()`) |
| POST | `/api/v1/auth/refresh` | Rotasi refresh token | PUBLIC (`@Public()`, body `refreshToken`) |
| POST | `/api/v1/auth/logout` | Logout, blacklist + revoke | LOGIN-only (tanpa dekorator, butuh Bearer) |
| GET | `/api/v1/auth/me` | Profil user + role + permissions | LOGIN-only (tanpa dekorator, butuh Bearer) |

### Users (sinkron dengan [user.md](./user.md#7-endpoint))

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/users` | Buat user oleh admin | PERMISSION: `user:create` |
| GET | `/api/v1/users` | List user | PERMISSION: `user:read` |
| GET | `/api/v1/users/:id` | Detail user | PERMISSION: `user:read` |
| PATCH | `/api/v1/users/:id` | Update user | PERMISSION: `user:update` |
| PATCH | `/api/v1/users/:id/role` | Ubah role user | PERMISSION: `user:update` |
| DELETE | `/api/v1/users/:id` | Hapus user | PERMISSION: `user:delete` |

> **Dua lapis:** guard `@Permissions('user:*')` (deny-by-default) **dan** gerbang eksplisit permission `admin:access` di `user.service` (list/create/findOne/update/delete/assignRole). Role custom dengan permission konten apa pun **tetap 403**.

### Roles (sinkron dengan [role.md](./role.md#7-endpoint))

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/roles` | Buat role | PERMISSION: `role:create` |
| GET | `/api/v1/roles` | List role | PERMISSION: `role:read` |
| GET | `/api/v1/roles/:id` | Detail role | PERMISSION: `role:read` |
| PATCH | `/api/v1/roles/:id` | Update role | PERMISSION: `role:update` |
| DELETE | `/api/v1/roles/:id` | Hapus role | PERMISSION: `role:delete` |

### Permissions (sinkron dengan [permission.md](./permission.md#7-endpoint))

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/permissions` | Buat permission | PERMISSION: `permission:create` |
| GET | `/api/v1/permissions` | List permission | PERMISSION: `permission:read` |
| GET | `/api/v1/permissions/:id` | Detail permission | PERMISSION: `permission:read` |
| PATCH | `/api/v1/permissions/:id` | Update permission | PERMISSION: `permission:update` |
| DELETE | `/api/v1/permissions/:id` | Hapus permission | PERMISSION: `permission:delete` |

### Role-Permissions (sinkron dengan [role-permissions.md](./role-permissions.md#7-endpoint))

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| PUT | `/api/v1/roles/:id/permissions` | Replace set permission role | PERMISSION: `permission:update` |
| GET | `/api/v1/roles/:id/permissions` | List permission milik role | PERMISSION: `permission:read` |

> Kedua endpoint `roles/:id/permissions` memakai permission **`permission:*` yang sudah ada** — bukan resource baru (`role-permission:*` tidak ada). `PUT` = `permission:update`, `GET` = `permission:read` (TETAP, sesuai controller).

### API Keys (sinkron dengan [api-key.md](./api-key.md#7-endpoint))

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/api-keys` | Buat API key (raw `key` tampil sekali) | PERMISSION: `apikey:create` |
| GET | `/api/v1/api-keys` | List API key (tanpa key/hash) | PERMISSION: `apikey:read` |
| GET | `/api/v1/api-keys/:id` | Detail API key | PERMISSION: `apikey:read` |
| PATCH | `/api/v1/api-keys/:id` | Update nama/permission API key | PERMISSION: `apikey:update` |
| DELETE | `/api/v1/api-keys/:id` | Hapus permanen (hard delete) | PERMISSION: `apikey:delete` |

> Akses data selain lewat JWT bisa memakai header **`x-api-key: <raw>`**; principal key membawa permission custom-nya sendiri. Modul lengkap: [api-key.md](./api-key.md).

### Story & Category (sinkron dengan [story.md](./story.md#11-tabel-endpoint-lengkap))

Modul `story` mengelola `Post` (resource backend `post`, label FE Story) + `Category`, upload gambar ke S3 lewat `POST /images`.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/posts` | Buat story | PERMISSION: `story:create` |
| GET | `/api/v1/posts` | List story | PERMISSION: `story:read` |
| GET | `/api/v1/posts/:id` | Detail story | PERMISSION: `story:read` |
| PATCH | `/api/v1/posts/:id` | Update story | PERMISSION: `story:update` |
| DELETE | `/api/v1/posts/:id` | Hapus story (+ row `images` & objek S3) | PERMISSION: `story:delete` |
| POST | `/api/v1/posts/:id/submit` | Ajukan story review (`DRAFT`→`REQUEST`) | PERMISSION: `story:submit` |
| POST | `/api/v1/posts/:id/approve` | Setujui & terbitkan story (`REQUEST`→`PUBLISHED`) | PERMISSION: `story:approve` |
| POST | `/api/v1/posts/:id/reject` | Tolak story (`REQUEST`→`DRAFT`) | PERMISSION: `story:reject` |
| POST | `/api/v1/posts/:id/publish` | Terbitkan story (`APPROVED`→`PUBLISHED`) | PERMISSION: `story:publish` |
| POST | `/api/v1/posts/:id/unpublish` | Tarik story (`PUBLISHED`→`DRAFT`) | PERMISSION: `story:unpublish` |
| POST | `/api/v1/categories` | Buat kategori (idempoten) | PERMISSION: `category:create` |
| GET | `/api/v1/categories` | List kategori | PERMISSION: `category:read` |
| GET | `/api/v1/categories/:id` | Detail kategori | PERMISSION: `category:read` |
| PATCH | `/api/v1/categories/:id` | Update kategori | PERMISSION: `category:update` |
| DELETE | `/api/v1/categories/:id` | Hapus kategori | PERMISSION: `category:delete` |
| POST | `/api/v1/images` | Upload gambar ke S3 (multipart `file`) | PERMISSION: `story:create`, `story:update` (ANY-of) |

> Tidak ada endpoint `GET /uploads` maupun permission `image:*`; gambar disajikan langsung oleh S3/CDN via URL absolut.

> **Permission action story (`story:submit`, `story:approve`, `story:reject`, `story:publish`, `story:unpublish`) kini di-enforce** oleh endpoint `POST /api/v1/posts/:id/<action>` (lihat [story.md](./story.md#action--transisi)). Transisi status tak valid → **409**. `PATCH /api/v1/posts/:id` (`story:update`) tetap untuk update konten.
>
> ⚠️ **Bypass workflow ditutup untuk non-admin.** Hanya scope `all` (permission moderator) yang masih bisa memaksa `status`/`publishedAt` via `PATCH`/`POST`; untuk `organization`/`own`/`published`, `create` dipaksa `status=DRAFT` (+ `publishedAt` dibuang) dan `update` mengabaikan `status`/`publishedAt` — **kecuali** pemilik (`organization`/`own`) boleh mengirim `status: DRAFT` untuk menarik kontennya sendiri yang `PUBLISHED` kembali ke `DRAFT` (lihat [§10](#10-row-level-scoping)). Follow-up: hapus `status`/`publishedAt` dari DTO setelah FE migrasi ke endpoint action.

### Organization (sinkron dengan [organization.md](./organization.md))

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/organizations` | Buat organization | PERMISSION: `organization:create` |
| GET | `/api/v1/organizations` | List organization | PERMISSION: `organization:read` |
| GET | `/api/v1/organizations/:id` | Detail organization | PERMISSION: `organization:read` |
| PATCH | `/api/v1/organizations/:id` | Update organization | PERMISSION: `organization:update` |
| DELETE | `/api/v1/organizations/:id` | Hapus organization | PERMISSION: `organization:delete` |

### Geographic Reference (sinkron dengan [country.md](./country.md), [region.md](./region.md) & [state.md](./state.md))

Data referensi geografis untuk dropdown pra-login → **PUBLIC**, tanpa RBAC.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| GET | `/api/v1/regions` | List region (dropdown) | PUBLIC (`@Public()`) |
| GET | `/api/v1/countries` | List negara (dropdown, pagination) | PUBLIC (`@Public()`) |
| GET | `/api/v1/countries/:id` | Detail negara by `id` (Int) | PUBLIC (`@Public()`) |
| GET | `/api/v1/states` | List state/provinsi (dropdown, pagination, filter `countryId`/`countryCode` — `countryCode` uppercase ISO-2, case-sensitive) | PUBLIC (`@Public()`) |
| GET | `/api/v1/states/:id` | Detail state by `id` (Int), + `country` | PUBLIC (`@Public()`) |

---

## 9. Error Handling Umum

Mapping status sesuai RULES bab 13:

| Status | Makna | Contoh kemunculan |
| --- | --- | --- |
| 400 | Bad Request | body/query tidak dapat dipahami, payload tidak sesuai |
| 401 | Unauthorized | JWT tidak ada / invalid / expired; credential login salah |
| 403 | Forbidden | JWT valid tapi permission kurang |
| 404 | Not Found | resource (user/role/permission) tidak ditemukan |
| 409 | Conflict | `email`/`name`/`code` duplikat; hapus role yang masih dipakai user |
| 422 | Unprocessable Entity | validasi DTO gagal (`errors` berisi detail per-field) |
| 500 | Internal Server Error | error tak terduga |

Format respon:

```json
// sukses
{ "data": { "id": "550e8400-e29b-41d4-a716-446655440000", "email": "admin@mail.com" }, "message": "success" }

// error validasi
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "password", "message": "password must be longer than or equal to 8 characters" }]
}

// error umum
{ "statusCode": 404, "message": "User not found", "errors": [] }
```

Detail exception per endpoint ada di tiap file module: [user.md](./user.md#8-error--exception) · [role.md](./role.md#8-error--exception) · [permission.md](./permission.md#8-error--exception) · [role-permissions.md](./role-permissions.md#8-error--exception).

---

## 10. Row-Level Scoping

Selain RBAC (permission per endpoint), konten `Post`/`Event` dibatasi **per baris** berdasarkan permission + organisasi/creator pemilik. Sumber tunggal: `AccessScopeService.resolve(userId, resource)` → `libs/src/core/auth/access-scope.service.ts` (provider global `LibsModule`). `User`/`Role`/`Permission` **tidak** memakai scoping ini — gerbang manajemen user/role = permission eksplisit `admin:access` (lihat §7).

### Resolusi scope

Penentuan scope **berbasis permission** (`role.permissions[].code`) + `organizationId`, **per-resource** (`resolve(userId, resource)` dengan `resource ∈ {'story','event'}`) — **tidak** memakai `role.code`/nama role, dan **bukan** penentu hak manajemen user/role (lihat `admin:access` di §7).

```typescript
export type ContentResource = 'story' | 'event';
export const CONTENT_MODERATOR_ACTIONS = ['approve', 'publish', 'reject', 'unpublish'] as const; // M6
export const CONTENT_WRITE_ACTIONS = ['create', 'update', 'submit'] as const;

export type AccessScope =
  | { kind: 'all'; canViewPrivate: boolean }                   // status-manager konten (resource ini)
  | { kind: 'organization'; organizationId: string; userId: string; canViewPrivate: boolean }
  | { kind: 'own'; userId: string; canViewPrivate: boolean }   // penulis konten tanpa organisasi
  | { kind: 'published'; canViewPrivate: boolean }
  | { kind: 'none'; canViewPrivate: boolean };

async resolve(userId: string, resource: ContentResource): Promise<AccessScope> {
  const codes = /* role.permissions[].code milik user */;
  const canViewPrivate = canViewPrivateFromCodes(codes); // hanya tulis/status-manager (H1)
  const isWriter = hasActions(codes, resource, CONTENT_WRITE_ACTIONS); // M2: per-resource
  if (hasActions(codes, resource, CONTENT_MODERATOR_ACTIONS)) return { kind: 'all', canViewPrivate };
  if (user?.organizationId && isWriter)
    return { kind: 'organization', organizationId: user.organizationId, userId, canViewPrivate };
  if (isWriter) return { kind: 'own', userId, canViewPrivate };
  return { kind: 'published', canViewPrivate };
}
```

| `kind` | Pemicu (permission, bukan nama role) | Arti |
| --- | --- | --- |
| `all` | salah satu `<resource>:approve\|publish\|reject\|unpublish` untuk resource terkait | Tanpa pembatasan baris. |
| `organization` | punya `organizationId` **dan** permission tulis resource terkait (`<resource>` × `create`/`update`/`submit`) | Hanya konten yang `creator.organizationId === organizationId`. |
| `own` | permission tulis resource terkait **tanpa** `organizationId` | Baca: konten miliknya **atau** konten terbit (M5). Tulis: hanya konten miliknya. |
| `published` | selain di atas | Baca hanya konten **yang sudah terbit**: `status = PUBLISHED` **dan** `publishedAt != null` **dan** `publishedAt <= now`; tidak punya hak tulis. Scheduled publish (publishedAt di masa depan) belum terlihat. |
| `none` | — | Tidak boleh apa-apa (dipertahankan untuk kompatibilitas; saat ini tak terpicu). |

`canViewPrivate` (boolean, **independen** dari `kind`) = punya permission **tulis** (`create`/`update`/`submit`) atau **status** (`approve`/`publish`/`reject`/`unpublish`) pada `story`/`event` — **bukan** sekadar `*:read` (H1). `admin`/`member`/`organization` lama punya tulis konten → tetap `true`; role custom read-only → `false` (tidak boleh baca PRIVATE).

> Scope **ortogonal** dengan permission: guard RBAC tetap jalan lebih dulu. Scoping hanya mempersempit baris yang boleh diakses setelah permission lolos. Role `published` (member) memang tak punya permission tulis, scoping hanya jaring pengaman tambahan.

### Baca (`list`)

Scope digabung (AND) ke filter list:

| `kind` | Perlakuan `list` |
| --- | --- |
| `all` | Tanpa tambahan. |
| `organization` | `{ creator: { organizationId } }` (post/event) / `{ organizationId }` (user) di-`AND` dengan filter. |
| `own` | `OR: [{ createdBy: userId }, <published-visible>]` (M5) di-`AND` dengan filter. |
| `published` | `{ status: PUBLISHED, publishedAt: { not: null, lte: now } }` di-`AND` dengan filter; **non-reader** (`!canViewPrivate`) ditambah `{ visibility: PUBLIC }`. Scheduled publish (masa depan) tak ikut. |
| `none` | **List kosong** `{ items: [], total: 0 }` (bukan 403). |

Parenthesis: scope hanya berlaku untuk `Post`/`Event` (di-`AND` ke `filterWhere`). `User` **tidak** memakai `AccessScope` lagi — `user.service` murni digerbang permission `admin:access`; `Role`/`Permission` memakai `@Permissions('role:*'/'permission:*')` (tanpa `AccessScope`).

### Baca (`findOne`) — 403 vs list kosong

| `kind` | `findOne` |
| --- | --- |
| `all` | Bebas. |
| `organization` | `creator.organizationId !== scope.organizationId` → **403** `ForbiddenException('Forbidden resource')`. |
| `own` | `createdBy !== scope.userId` **dan** baris bukan konten terbit → **403** (M5). |
| `published` | `status !== PUBLISHED` **atau** `publishedAt == null` **atau** `publishedAt > now` → **403**. |
| `none` | **403**. |

Kontras: `list` menyembunyikan baris (hasil kosong), `findOne` menolak eksplisit dengan **403**.

### Tulis (`create`/`update`/`remove`/`transition`)

| `kind` | Perlakuan |
| --- | --- |
| `all` | Bebas. |
| `organization` | `create` diizinkan (konten baru milik creator di org-nya); `update`/`remove`/`transition` hanya bila baris `creator.organizationId === scope.organizationId`, selain itu **403**. |
| `own` | `create` diizinkan (konten baru milik `createdBy = userId`); `update`/`remove`/`transition` hanya bila baris `createdBy === scope.userId`, selain itu **403**. |
| `published` | **403** (defensif; guard permission umumnya sudah memblok lebih dulu). |
| `none` | **403**. |

### Bypass workflow ditutup

Untuk scope `!= all`, field `status`/`publishedAt` dari body **diabaikan**, kecuali satu kasus: pemilik (`organization`/`own`) boleh menarik kontennya sendiri yang berstatus `PUBLISHED` kembali ke `DRAFT` ("save as draft").

- `create` → paksa `status = DRAFT`, `publishedAt = undefined` (dan `approvedAt` tidak diisi).
- `update` → blok `status`/`publishedAt` dilewati; hanya konten yang berubah. **Kecuali**: baris miliknya (`creator.organizationId === scope.organizationId` untuk `organization`, `createdBy === userId` untuk `own`) berstatus `PUBLISHED` dan body mengirim `status: DRAFT` → `status` di-set `DRAFT`; `publishedAt`/`approvedAt` **dipertahankan** (konsisten transisi `unpublish`). Nilai `status` lain (`REQUEST`/`APPROVED`/`PUBLISHED`) dan `publishedAt` tetap diabaikan.

Akibatnya role `organization` tidak bisa memaksa `PUBLISHED`/`APPROVED` lewat `POST`/`PATCH` — harus lewat endpoint action (`story:publish`/`event:publish`, yang tidak dimilikinya). Scope `all` (status-manager) tetap bisa (backward-compat FE).

### Cakupan

| Domain | Scoping | Catatan |
| --- | --- | --- |
| `Post` (`post.service.ts`) | ✅ | `resolve(userId, 'story')`; `creator.organizationId`; list/findOne/create/update/remove/transition. |
| `Event` (`event.service.ts`) | ✅ | `resolve(userId, 'event')`; idem post. |
| `User` (`user.service.ts`) | ✗ (ganti) | **Tidak** pakai `AccessScope`; gerbang permission eksplisit `admin:access` untuk list/findOne/create/update/delete/assignRole. |
| `Role`/`Permission` | ✗ | Gerbang `@Permissions('role:*'/'permission:*')`; tanpa `AccessScope`. |
| `Organization` | ✗ | Admin-only via permission `organization:*`; tanpa scoping baris. |
| `Category` | ✗ | Taksonomi global; `organization` hanya punya `category:read`. |
