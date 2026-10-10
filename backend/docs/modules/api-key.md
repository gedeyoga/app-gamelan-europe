# Module: API Key

Menu: [rbac.md](./rbac.md) (master) · [user.md](./user.md) · [role.md](./role.md) · [permission.md](./permission.md) · [role-permissions.md](./role-permissions.md)

---

## 1. Overview

Modul `api-key` menyediakan kredensial alternatif untuk mengakses data backend **tanpa JWT**, lewat header `x-api-key`. Setiap key membawa **permission custom** (`resource:action`) yang menggantikan permission dari role user.

Karakteristik:

- **Tanpa expiry** — key berlaku sampai dihapus.
- **Diakses lewat `DELETE` permanen** (hard delete) — bukan revoke; baris `api_keys` + join `api_key_permissions` ikut terhapus.
- **Raw key hanya tampil sekali** saat `POST` (field `key`). DB hanya menyimpan `keyHash` (SHA-256); raw tidak pernah disimpan/dilog.
- Principal API key terikat ke `creator` (user pembuat) untuk audit, tetapi **permission-nya dari key**, bukan role creator.

Alur akses:

```
Client ── x-api-key: <raw> ──> JwtAuthGuard.authenticate(raw)
  └─ hash → findByHash → principal { id: creator.id, apiKeyId, permissions }
       └─ PermissionsGuard: cek @Permissions vs principal.permissions (deny-by-default)
```

> API key **tidak** mendapat pengecualian LOGIN-only. Endpoint tanpa `@Permissions(...)` selalu **403** untuk principal API key (lihat §6).

Lokasi kode:

```
libs/src/modules/api-key/
├── api-key.repository.ts
├── api-key.service.ts
├── api-key.module.ts
├── api-key.service.spec.ts
├── dto/
│   ├── create-api-key.dto.ts
│   ├── update-api-key.dto.ts
│   └── list-api-keys-query.dto.ts
└── entities/
    └── api-key.entity.ts

apps/app/src/controllers/api-keys.controller.ts   ← controller di apps/* (RULES bab 3)
```

---

## 2. Model Prisma

```prisma
model ApiKey {
  id          String            @id @default(uuid())
  name        String
  keyHash     String            @unique @map("key_hash")
  prefix      String            @map("prefix")
  lastUsedAt  DateTime?         @map("last_used_at")
  createdBy   String            @map("created_by")
  creator     User              @relation("ApiKeyCreator", fields: [createdBy], references: [id], onDelete: Cascade)
  permissions ApiKeyPermission[]
  createdAt   DateTime          @default(now()) @map("created_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")

  @@index([createdBy])
  @@map("api_keys")
}

model ApiKeyPermission {
  apiKeyId     String     @map("api_key_id")
  permissionId String     @map("permission_id")
  apiKey       ApiKey     @relation(fields: [apiKeyId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now()) @map("created_at")

  @@id([apiKeyId, permissionId])
  @@index([permissionId])
  @@map("api_key_permissions")
}
```

- `keyHash` unik & tidak pernah di-`select` (entity menyembunyikannya — [§3](#3-entity-payload-type)).
- Tanpa kolom `status`/`revokedAt` — pencabutan = hard delete.
- `onDelete: Cascade` pada `creator` & join: hapus user/permission otomatis membersihkan relasinya.

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4). `keyHash` **tidak** ada di select; `permissions` (join) di-flatten jadi `string[]` (code) oleh `mapApiKey`.

```typescript
// libs/src/modules/api-key/entities/api-key.entity.ts
export const apiKeySelect = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  permissions: { select: { permission: { select: { code: true } } } },
} satisfies Prisma.ApiKeySelect;

export type ApiKeyEntity = Omit<ApiKeyPayload, 'permissions'> & { permissions: string[] };
```

---

## 4. DTO

Status validasi gagal = **422**. `@Param('id')` pakai `ParseUUIDPipe`.

| Field | Aturan |
| --- | --- |
| `name` | string, trim, required, `MaxLength(100)` |
| `permissionCodes` | array, `ArrayMinSize(1)`, tiap item `IsString` + trim |
| `:id` | UUID (ParseUUIDPipe) |

`UpdateApiKeyDto = PartialType(CreateApiKeyDto)` → `name?`, `permissionCodes?`.

Code permission tak dikenal saat create/update → **422** `Unknown permission code(s): <codes>`.

---

## 5. Service

| Method | Perilaku |
| --- | --- |
| `create(dto, creatorUserId)` | `raw = 'gke_' + randomBytes(32).toString('base64url')`; `keyHash = sha256(raw)` hex; `prefix = raw.slice(0,12)`; resolve code → id; simpan ApiKey + join (nested write). Return entity + `key: raw` (**hanya di sini**). |
| `list(query)` | Paginasi + filter/sort/search (`API_KEY_FILTER_FIELDS`/`SORT_FIELDS`; search `name`,`prefix`). |
| `findOne(id)` | Detail, tanpa raw/hash. |
| `update(id, dto)` | Update `name`; bila `permissionCodes` ada → **replace-all** transactional (tiru `role-permissions`). |
| `remove(id)` | Hard delete. |
| `authenticate(raw)` | `sha256(raw)` → `findByHash`; null → **401** `Invalid API key`; update `lastUsedAt` best-effort (tanpa await); return principal JWT-like + `apiKeyId` + `permissions`. |

---

## 6. Guards

- **`JwtAuthGuard`**: `@Public()` → lolos; header `x-api-key` ada → `request.user = authenticate(raw)`, return true; selain itu JWT seperti biasa.
- **`PermissionsGuard`**: principal API key memakai `user.permissions` bawaan (tanpa query DB); metadata `@Permissions` kosong pada principal API key → **403** `Permission required`.

---

## 7. Endpoint

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`, list `{ data, message, meta }`, error `{ statusCode, message, errors }`.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/api-keys` | Buat API key (raw `key` sekali) | PERMISSION: `apikey:create` |
| GET | `/api/v1/api-keys` | List API key (tanpa key/hash) | PERMISSION: `apikey:read` |
| GET | `/api/v1/api-keys/:id` | Detail API key | PERMISSION: `apikey:read` |
| PATCH | `/api/v1/api-keys/:id` | Update nama/permission | PERMISSION: `apikey:update` |
| DELETE | `/api/v1/api-keys/:id` | Hapus permanen (hard delete) | PERMISSION: `apikey:delete` |

Endpoint pengelolaan ini dapat diakses via JWT **atau** API key yang punya `apikey:*`.

> Seeder permission: `pnpm prisma:seed:api-key` (semua permission minus `admin:access`) dan `pnpm prisma:seed:api-key:archive` (hanya `archive:*`, untuk integrasi data archive). Keduanya idempoten, replace-all permission tiap API key existing.

---

## 8. Error

| Status | Pesan | Pemicu |
| --- | --- | --- |
| 401 | `Invalid API key` | `x-api-key` tidak dikenal. |
| 403 | `Permission required` | Principal API key di endpoint tanpa `@Permissions`. |
| 403 | `Forbidden resource` | Permission key tidak mencukupi. |
| 404 | `API key not found` | `:id` tidak ada (juga `P2025`). |
| 422 | `Unknown permission code(s): ...` | `permissionCodes` ada code tak dikenal. |
| 422 | `Validation failed` | DTO invalid (mis. `permissionCodes` kosong). |

---

## 9. Contoh curl

```bash
# Buat key (butuh JWT dengan apikey:create)
curl -X POST http://localhost:3001/api/v1/api-keys \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Integrasi Partner","permissionCodes":["story:read","event:read"]}'
# → { "data": { "id": "...", "name": "...", "prefix": "gke_ab12cd34", "permissions": ["story:read","event:read"], "key": "gke_..." }, "message": "success" }

# List
curl "http://localhost:3001/api/v1/api-keys?page=1&limit=20&search=partner" \
  -H "Authorization: Bearer <JWT>"

# PATCH
curl -X PATCH http://localhost:3001/api/v1/api-keys/<id> \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Partner v2","permissionCodes":["story:read"]}'

# DELETE (hard delete)
curl -X DELETE http://localhost:3001/api/v1/api-keys/<id> \
  -H "Authorization: Bearer <JWT>"
# → { "data": null, "message": "success" }

# Pakai key untuk akses data
curl http://localhost:3001/api/v1/posts \
  -H "x-api-key: gke_..."
```

---

## 10. Row-Level Scope (by design)

Dua lapis otorisasi berjalan terpisah:

| Lapis | Sumber | Berlaku |
| --- | --- | --- |
| **Gate endpoint** | `permissions` **milik key** (`ApiKeyPermission`) | `PermissionsGuard` — apakah key boleh memanggil endpoint. |
| **Row-level scope** | `AccessScopeService.resolve(ownerId, resource)` | Service konten — baris mana yang boleh dibaca/ditulis (`resource ∈ {'story','event'}`). |

- Principal API key mengeset `id = creator.id` (owner). Karena itu `AccessScopeService.resolve(user.id, resource)` di service konten memakai **permission & organisasi owner**, bukan permission key. Scope dihitung **per-resource** (M2).
- **Konsekuensi**: key milik `admin` → scope `all` (bisa lihat semua baris); key milik user dengan permission tulis event → scope `network`/`own` sesuai resource + `networkId`; key tanpa tulis → `published`.
- Scope di-resolve **fresh dari DB** tiap request (single source of truth) — role owner berubah → scope key ikut berubah tanpa perlu buat ulang key.
- `creator.status !== ACTIVE` (`INACTIVE`/`BLOCKED`) → key langsung invalid (**401**), meski hash cocok.

> ⚠️ **`apikey:create` setara privileged.** Pemegang permission ini bisa membuat key dengan permission apa pun (termasuk melebihi permission miliknya sendiri), lalu mengakses data sesuai scope owner-nya. Batasi `apikey:create` hanya ke role tepercaya (mis. `admin`). Saat ini hanya `admin` yang memilikinya di seed.

