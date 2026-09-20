# Module: Subscription

Menu: [billing.md](./billing.md)

> **STATUS: DIIMPLEMENTASIKAN (backend).** CRUD `Subscription` tersedia dengan **soft-delete**. **Tanpa migration baru** — model `Subscription` sudah ada sejak migration init repo; hanya entity/service/controller + 4 permission `subscription:*` yang ditambahkan.

---

## 1. Deskripsi & Lokasi

Modul **`subscription`** mengelola `Subscription` (paket langganan). Relasi: `Billing.subscriptionId → Subscription.id` (1 : N, `onDelete: Restrict`). Karena Billing mem-restrict penghapusan, DELETE Subscription adalah **soft-delete** (`deletedAt`), bukan hard delete.

Pengelolaan admin-only: endpoint butuh permission `subscription:create/read/update/delete`.

Lokasi kode:

```
libs/src/modules/subscription/
├── subscription.repository.ts
├── subscription.service.ts
├── subscription.module.ts
├── dto/
│   ├── create-subscription.dto.ts
│   ├── update-subscription.dto.ts
│   └── list-subscriptions-query.dto.ts
└── entities/
    └── subscription.entity.ts

apps/app/src/controllers/subscriptions.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

Alur baku `Controller → Service → Repository → Prisma`. Modul didaftarkan di `libs/src/libs.module.ts` (imports + exports) dan controller di `apps/app/src/app.module.ts`.

### Tidak ada migration baru

Model `Subscription` sudah ada di `libs/prisma/schema.prisma`. Jalankan `pnpm prisma:seed` untuk menambah 4 permission `subscription:*`.

---

## 2. Model Prisma

```prisma
model Subscription {
  id               String           @id @default(uuid())
  name             String
  slug             String           @unique
  subscriptionType SubscriptionType @map("subscription_type")
  currency         String
  billings         Billing[]
  createdAt        DateTime         @default(now()) @map("created_at")
  updatedAt        DateTime         @updatedAt @map("updated_at")
  deletedAt        DateTime?        @map("deleted_at")

  @@map("subscriptions")
}
```

- `slug` unik → duplikat `P2002` → **409** `ConflictException('Subscription slug already exists')`.
- `deletedAt` soft-delete; baris `deletedAt != null` selalu dikecualikan di list & findById.
- Relasi `Billing` `onDelete: Restrict` → tidak boleh hard delete.

---

## 3. Entity Payload Type

```typescript
// libs/src/modules/subscription/entities/subscription.entity.ts
export const subscriptionSelect = {
  id: true,
  name: true,
  slug: true,
  subscriptionType: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionSelect;
```

`deletedAt` **tidak** di-select → tidak pernah keluar ke FE. Tidak ada kolom Decimal (mapping passthrough lewat `mapSubscription`).

---

## 4. DTO / Query List

Status validasi gagal = **422** (RULES bab 7). Semua `@Param('id')` pakai `ParseUUIDPipe`.

| Field | Aturan |
| --- | --- |
| `name` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `slug` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)`, `@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)` (kebab-case) |
| `subscriptionType` | `@IsEnum(SubscriptionType)` (`MONTHLY` / `YEARLY`) |
| `currency` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(10)` |

`UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto)`.

### Konstanta list

| Konstanta | Nilai |
| --- | --- |
| `SUBSCRIPTION_SEARCHABLE_FIELDS` | `['name', 'slug', 'currency']` |
| `SUBSCRIPTION_SORT_FIELDS` | `['name', 'slug', 'subscriptionType', 'currency', 'createdAt', 'updatedAt']` |
| `SUBSCRIPTION_FILTER_FIELDS` | `['name', 'slug', 'subscriptionType', 'currency', 'createdAt', 'updatedAt']` |
| `SUBSCRIPTION_DATE_FIELDS` | `['createdAt', 'updatedAt']` |

`filter[subscriptionType]` divalidasi enum → nilai tak valid 422. `page` default 1, `limit` default 20 (clamp 100).

---

## 5. Repository & Service

### Repository

| Method | Fungsi |
| --- | --- |
| `findById(id)` | `findFirst({ where: { id, deletedAt: null } })`; tidak ada → `NotFoundException('Subscription not found')`. |
| `findMany({ where, skip, take, orderBy })` | List paginated (`$transaction`: `findMany` + `count`). |
| `create(data)` | Insert; `P2002` → 409. |
| `update(id, data)` | Pre-check `deletedAt: null` → 404; update; `P2002` → 409. |
| `remove(id)` | Pre-check → 404; set `deletedAt = now()` (soft-delete). |

### Service

| Method | Fungsi |
| --- | --- |
| `list(query)` | `buildWhere` + `{ deletedAt: null }` + `buildSearch` + `combineWhere` + `buildOrderBy`. |
| `findOne(id)` | `repository.findById`. |
| `create(dto)` | Petakan field DTO → `repository.create`. |
| `update(id, dto)` | Body kosong → `findOne(id)` tanpa update. |
| `remove(id)` | Soft-delete via `repository.remove`. |

---

## 6. Endpoint & Permission

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta: { page, limit, total }, message }`.

| Method | Path | Akses | Response sukses | Error |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/subscriptions` | PERMISSION `subscription:create` | 201 `{ data: <subscription>, message }` | 409, 422, 401/403 |
| GET | `/api/v1/subscriptions` | PERMISSION `subscription:read` | 200 `{ data: [subscription], meta, message }` | 422, 401/403 |
| GET | `/api/v1/subscriptions/:id` | PERMISSION `subscription:read` | 200 `{ data: <subscription>, message }` | 404, 422 UUID invalid, 401/403 |
| PATCH | `/api/v1/subscriptions/:id` | PERMISSION `subscription:update` | 200 `{ data: <subscription>, message }` | 404, 409, 422, 401/403 |
| DELETE | `/api/v1/subscriptions/:id` | PERMISSION `subscription:delete` | 200 `{ data: <subscription>, message }` | 404, 422 UUID invalid, 401/403 |

### Contoh query

- `GET /api/v1/subscriptions?page=1&limit=20&sortBy=name&sortOrder=asc`
- `GET /api/v1/subscriptions?search=monthly`
- `GET /api/v1/subscriptions?filter[subscriptionType]=MONTHLY`

---

## 7. Error & Exception

| Exception | Status | Penyebab |
| --- | --- | --- |
| `NotFoundException` | 404 | subscription tidak ditemukan / sudah soft-deleted |
| `ConflictException` | 409 | `slug` sudah dipakai (`P2002`) |
| `UnprocessableEntityException` | 422 | validasi DTO / sortBy / filter |
| `UnauthorizedException` | 401 | JWT tidak ada / invalid |
| `ForbiddenException` | 403 | permission kurang |
