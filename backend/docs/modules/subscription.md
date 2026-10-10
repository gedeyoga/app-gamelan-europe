# Module: Subscription

Menu: [billing.md](./billing.md)

> **STATUS: DIIMPLEMENTASIKAN (backend).** CRUD `Subscription` tersedia dengan **soft-delete**. Model `Subscription` sudah ada sejak migration init repo; kolom `price` & `duration_in_days` ditambahkan lewat migration `20261007000000_add_subscription_price_duration`. Entity/service/controller + 4 permission `subscription:*` ikut ditambahkan.

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

### Migration

Model `Subscription` sudah ada di migration init (`20260919141052_init_project_schema_db`), tetapi kolom `price` (`DECIMAL(12,2)`) & `duration_in_days` (`INTEGER`) ditambahkan pada migration `20261007000000_add_subscription_price_duration`. Migration menambah kolom `NOT NULL` dengan `DEFAULT` sementara lalu `DROP DEFAULT`, sehingga aman bila tabel sudah berisi baris dan state akhir tetap tanpa default (cocok dengan §2).

Terapkan dengan `pnpm prisma:migrate:deploy` (prod) atau `pnpm prisma:migrate:dev` (lokal). Jalankan `pnpm prisma:seed` untuk menambah 4 permission `subscription:*`.

---

## 2. Model Prisma

```prisma
enum SubscriptionStatus {
  ACTIVE
  INACTIVE
}

model Subscription {
  id               String             @id @default(uuid())
  name             String
  slug             String             @unique
  subscriptionType SubscriptionType   @map("subscription_type")
  status           SubscriptionStatus @default(ACTIVE)
  currency         String
  price            Decimal            @db.Decimal(12, 2)
  durationInDays   Int                @map("duration_in_days")
  billings         Billing[]
  createdAt        DateTime           @default(now()) @map("created_at")
  updatedAt        DateTime           @updatedAt @map("updated_at")
  deletedAt        DateTime?          @map("deleted_at")

  @@map("subscriptions")
}
```

- `status` (`SubscriptionStatus`, enum `ACTIVE`/`INACTIVE`) → **menggating ketersediaan**. Endpoint `/api/v1/subscriptions/available` **memaksa** `status = ACTIVE` (lewat `listAvailable`, menimpa `filter[status]` dari user → paket `INACTIVE` tetap tersembunyi), dan `findMine` (`/api/v1/subscriptions/me`) hanya mengembalikan paket user bila `subscription.status = ACTIVE`. Default `ACTIVE` (kolom `status`, tanpa `@map` karena sudah snake_case); ditambahkan lewat migration `20261007010000_add_subscription_status`. List admin `GET /api/v1/subscriptions` **tidak** memaksa status: admin tetap melihat semua paket dan `filter[status]` tetap berfungsi (opt-in).

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
  status: true,
  currency: true,
  price: true,
  durationInDays: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionSelect;
```

`deletedAt` **tidak** di-select → tidak pernah keluar ke FE. `price` bertipe Prisma `Decimal` → entity meng-override jadi `number` (`Omit<SubscriptionPayload, 'price'> & { price: number; subscriberCount: number }`); `mapSubscription(row, subscriberCount = 0)` memakai `Number(row.price)`, sisanya passthrough.

**`subscriberCount`** = field **terhitung** (bukan kolom DB, tidak ada di `subscriptionSelect`): jumlah **user unik** yang punya `Billing` dengan `status = PAID` untuk subscription tsb. Dihitung query terpisah (lihat §5) dan ditempel service ke entity; create selalu `0` (belum ada Billing).

---

## 4. DTO / Query List

Status validasi gagal = **422** (RULES bab 7). Semua `@Param('id')` pakai `ParseUUIDPipe`.

| Field | Aturan |
| --- | --- |
| `name` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `slug` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)`, `@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)` (kebab-case) |
| `subscriptionType` | `@IsEnum(SubscriptionType)` (`MONTHLY` / `YEARLY`) |
| `status` | `@IsOptional()`, `@IsEnum(SubscriptionStatus)` (`ACTIVE` / `INACTIVE`); default `ACTIVE` bila kosong |
| `currency` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(10)` |
| `price` | `@Type(() => Number)`, `@IsNumber({ maxDecimalPlaces: 2 })`, `@Min(0)` (Decimal 12,2) |
| `durationInDays` | `@Type(() => Number)`, `@IsInt()`, `@Min(1)` |

`UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto)`.

### Konstanta list

| Konstanta | Nilai |
| --- | --- |
| `SUBSCRIPTION_SEARCHABLE_FIELDS` | `['name', 'slug', 'currency']` |
| `SUBSCRIPTION_SORT_FIELDS` | `['name', 'slug', 'subscriptionType', 'status', 'currency', 'price', 'durationInDays', 'createdAt', 'updatedAt']` |
| `SUBSCRIPTION_FILTER_FIELDS` | `['name', 'slug', 'subscriptionType', 'status', 'currency', 'durationInDays', 'createdAt', 'updatedAt']` |
| `SUBSCRIPTION_NUMBER_FIELDS` | `['durationInDays']` |
| `SUBSCRIPTION_DATE_FIELDS` | `['createdAt', 'updatedAt']` |

`price` (Decimal) hanya sortable, **tidak** filterable — util `parseNumberInput` hanya menerima Int 32-bit (lihat `list-filter.util.ts`), belum ada koersi Decimal. `filter[durationInDays]` divalidasi integer 32-bit. `filter[subscriptionType]` & `filter[status]` divalidasi enum → nilai tak valid 422. `page` default 1, `limit` default 20 (clamp 100).

---

## 5. Repository & Service

### Repository

| Method | Fungsi |
| --- | --- |
| `findById(id)` | `findFirst({ where: { id, deletedAt: null } })`; tidak ada → `NotFoundException('Subscription not found')`. |
| `findMineByUser(userId)` | Billing non-`CANCELED` terbaru milik user dengan `subscription: { deletedAt: null, status: 'ACTIVE' }`; tidak ada billing/paket INACTIVE → `null`. |
| `findMany({ where, skip, take, orderBy })` | List paginated (`$transaction`: `findMany` + `count`). |
| `create(data)` | Insert; `P2002` → 409. |
| `update(id, data)` | Pre-check `deletedAt: null` → 404; update; `P2002` → 409. |
| `remove(id)` | Pre-check → 404; set `deletedAt = now()` (soft-delete). |
| `countSubscribers(ids)` | Jumlah user unik PAID per subscription. `billing.groupBy({ by: ['subscriptionId', 'userId'], where: { subscriptionId: { in: ids }, status: 'PAID' } })` → `Map<subscriptionId, number>`. `ids` kosong → Map kosong (tanpa query). Batched: 1 query untuk N id (anti N+1). |

### Service

`subscriberCount` ditempel lewat helper privat: `attachCounts(items)` (batch, dari `items.map(i => i.id)`) & `attachCount(item)` (single).

| Method | Fungsi |
| --- | --- |
| `list(query)` | `buildWhere` + `{ deletedAt: null }` + `buildSearch` + `combineWhere` + `buildOrderBy`; hasil `repository.findMany` → `attachCounts`. |
| `listAvailable(query)` | Sama dengan `list()` tetapi `status` **dipaksa** `ACTIVE` (menimpa `filter[status]` user) → paket `INACTIVE` tak pernah muncul di katalog. |
| `findOne(id)` | `repository.findById` → `attachCount`. |
| `findMine(userId)` | `repository.findMineByUser` → `attachCount` (null passthrough). |
| `create(dto)` | Petakan field DTO → `repository.create`; `subscriberCount` = `0` tanpa query. |
| `update(id, dto)` | Body kosong → `findOne(id)` tanpa update; selain itu `repository.update` → `attachCount`. |
| `remove(id)` | Soft-delete via `repository.remove` → `attachCount`. |

---

## 6. Endpoint & Permission

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta: { page, limit, total }, message }`. Setiap `<subscription>` pada `data` menyertakan `subscriberCount` (compute; lihat §3): list berisi nilai per item, single = nilai subscription itu, `create` = `0`.

| Method | Path | Akses | Response sukses | Error |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/subscriptions` | PERMISSION `subscription:create` | 201 `{ data: <subscription>, message }` | 409, 422, 401/403 |
| GET | `/api/v1/subscriptions` | PERMISSION `subscription:read` | 200 `{ data: [subscription], meta, message }` | 422, 401/403 |
| GET | `/api/v1/subscriptions/me` | LOGIN-only (self-service) | 200 `{ data: <subscription>\|null, message }` (hanya paket `ACTIVE`) | 401 |
| GET | `/api/v1/subscriptions/available` | LOGIN-only | 200 `{ data: [subscription], meta, message }` (selalu `status=ACTIVE`) | 422, 401 |
| GET | `/api/v1/subscriptions/:id` | PERMISSION `subscription:read` | 200 `{ data: <subscription>, message }` | 404, 422 UUID invalid, 401/403 |
| PATCH | `/api/v1/subscriptions/:id` | PERMISSION `subscription:update` | 200 `{ data: <subscription>, message }` | 404, 409, 422, 401/403 |
| DELETE | `/api/v1/subscriptions/:id` | PERMISSION `subscription:delete` | 200 `{ data: <subscription>, message }` | 404, 422 UUID invalid, 401/403 |

### Contoh query

- `GET /api/v1/subscriptions?page=1&limit=20&sortBy=name&sortOrder=asc`
- `GET /api/v1/subscriptions?search=monthly`
- `GET /api/v1/subscriptions?filter[subscriptionType]=MONTHLY`
- `GET /api/v1/subscriptions?filter[status]=ACTIVE`

---

## 7. Error & Exception

| Exception | Status | Penyebab |
| --- | --- | --- |
| `NotFoundException` | 404 | subscription tidak ditemukan / sudah soft-deleted |
| `ConflictException` | 409 | `slug` sudah dipakai (`P2002`) |
| `UnprocessableEntityException` | 422 | validasi DTO / sortBy / filter |
| `UnauthorizedException` | 401 | JWT tidak ada / invalid |
| `ForbiddenException` | 403 | permission kurang |
