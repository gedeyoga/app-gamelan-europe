# Module: Billing

Menu: [subscription.md](./subscription.md)

> **STATUS: DIIMPLEMENTASIKAN (backend).** CRUD `Billing` + `BillingLine` tersedia. **Tanpa migration baru** — model `Billing`/`BillingLine` sudah ada sejak migration init repo; hanya entity/service/controller + 4 permission `billing:*` yang ditambahkan.

---

## 1. Deskripsi & Lokasi

Modul **`billing`** mengelola `Billing` (tagihan) beserta `BillingLine` (rincian baris). Relasi:

- `Billing.userId → User.id` (wajib, `onDelete: Cascade`)
- `Billing.networkId → Network.id` (opsional, `onDelete: SetNull`)
- `Billing.subscriptionId → Subscription.id` (wajib, `onDelete: Restrict`)
- `BillingLine.billingId → Billing.id` (wajib, `onDelete: Cascade`)

Lokasi kode:

```
libs/src/modules/billing/
├── billing.repository.ts
├── billing.service.ts
├── billing.module.ts
├── dto/
│   ├── create-billing.dto.ts
│   ├── update-billing.dto.ts
│   ├── billing-line.dto.ts
│   └── list-billings-query.dto.ts
└── entities/
    └── billing.entity.ts

apps/app/src/controllers/billings.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

### Tidak ada migration baru

Jalankan `pnpm prisma:seed` untuk menambah 4 permission `billing:*`.

---

## 2. Entity Payload Type

```typescript
// libs/src/modules/billing/entities/billing.entity.ts
export const billingSelect = {
  id: true, userId: true, networkId: true, subscriptionId: true,
  code: true, status: true, subscriptionType: true, currency: true,
  total: true, discount: true, tax: true, paidAt: true, canceledAt: true,
  user: { select: { id: true, fullName: true, email: true } },
  network: { select: { id: true, name: true } },   // nullable
  subscription: { select: { id: true, name: true, slug: true } },
  lines: { select: { id: true, description: true, type: true, qty: true, amount: true, currency: true } },
  createdAt: true, updatedAt: true,
} satisfies Prisma.BillingSelect;
```

- `total` → `number`; `discount`/`tax` → `number | null`; `lines[].amount` → `number`.
- `network` nullable (bila `networkId` null).

---

## 3. DTO / Validasi

`CreateBillingDto`:

| Field | Aturan |
| --- | --- |
| `userId` | `@IsUUID()` wajib |
| `networkId` | opsional, `@IsUUID()` |
| `subscriptionId` | `@IsUUID()` wajib |
| `code` | trim, `@IsNotEmpty()`, `@MaxLength(100)`; duplikat → **409** `ConflictException('Billing code already exists')` |
| `status` | opsional, `@IsEnum(BillingStatus)` (`PENDING`/`PAID`/`CANCELED`) |
| `subscriptionType` | `@IsEnum(SubscriptionType)` wajib |
| `currency` | trim, `@IsNotEmpty()`, `@MaxLength(10)` |
| `total` | `@IsNumber()`, `@Min(0)` (number JSON) |
| `discount`, `tax` | opsional, `@IsNumber()`, `@Min(0)` |
| `paidAt`, `canceledAt` | opsional, `@IsISO8601()` |
| `lines` | `@IsArray()`, `@ValidateNested({ each: true })` — 0..N boleh kosong |

`BillingLineDto`: `description` trim wajib max 500; `type` `@IsEnum(BillingLineType)` (`ITEM`/`DISCOUNT`/`TAX`); `qty` opsional `@IsInt() @Min(1)`; `amount` `@IsNumber() @Min(0)`; `currency` trim wajib max 10.

`UpdateBillingDto extends PartialType(CreateBillingDto)`. Bila `lines` dikirim saat PATCH → **REPLACE** seluruh lines (`deleteMany` + `createMany` dalam satu transaksi). Bila tidak dikirim → lines tetap.

### Semantik `null`

`@IsOptional()` meloloskan `null` untuk field opsional (validasi tipe dilewati). Arti `null` **eksplisit** (dikirim FE) dibedakan dari `undefined` (property absen):

| Field | `undefined` | `null` eksplisit |
| --- | --- | --- |
| `networkId` | create: relasi tidak di-set · update: tidak disentuh | create: diabaikan (relasi tetap null) · update: **`{ disconnect: true }`** (lepas organisasi) |
| `discount`, `tax` | create: skip (default null) · update: tidak disentuh | **clear** → `null` |
| `paidAt`, `canceledAt` | create: skip (default null) · update: tidak disentuh | **clear** → `null` (bukan `new Date(null)`) |

`userId`/`subscriptionId` **wajib non-null** (tanpa `@IsOptional()`; `null` → 422). String non-null untuk `paidAt`/`canceledAt` dikonversi `new Date(iso)`.

### Konstanta list

| Konstanta | Nilai |
| --- | --- |
| `BILLING_SEARCHABLE_FIELDS` | `['code', 'currency']` |
| `BILLING_SORT_FIELDS` | `['code', 'status', 'subscriptionType', 'currency', 'total', 'paidAt', 'canceledAt', 'createdAt', 'updatedAt', 'user.fullName', 'subscription.name']` |
| `BILLING_FILTER_FIELDS` | `['code', 'status', 'subscriptionType', 'currency', 'userId', 'networkId', 'subscriptionId', 'paidAt', 'canceledAt', 'createdAt', 'updatedAt']` |
| `BILLING_DATE_FIELDS` | `['paidAt', 'canceledAt', 'createdAt', 'updatedAt']` |

Sort kolom relasi didukung via `BILLING_SORT_MAP` (dipakai `buildOrderBy`):

| `sortBy` | Order |
| --- | --- |
| `user.fullName` | `{ user: { fullName: dir } }` |
| `subscription.name` | `{ subscription: { name: dir } }` |

> `filter[canceledAt]` didukung (sejajar `paidAt`); format nilai ISO 8601.

---

## 4. Repository & Service

### Repository

| Method | Fungsi |
| --- | --- |
| `findById(id)` | `findUnique`; tidak ada → `NotFoundException('Billing not found')`. |
| `findMany({ where, skip, take, orderBy })` | List paginated (`$transaction`). |
| `create(data)` | Insert + nested `lines: { create: [...] }`; `P2002` → 409. |
| `update(id, data, lines?)` | Transaksi: update scalar → bila `lines` ada, `deleteMany` + `createMany`; `P2002` → 409. |
| `remove(id)` | Delete; `billing_lines` ikut terhapus (`Cascade`). |

### Service

| Method | Fungsi |
| --- | --- |
| `list(query)` | `buildWhere` (enum `status`/`subscriptionType` + date) + `buildSearch` + `combineWhere` + `buildOrderBy`. |
| `findOne(id)` | `repository.findById`. |
| `create(dto)` | Bangun `BillingCreateInput` (`connect` user/subscription, nested lines). |
| `update(id, dto)` | Kumpulkan field `!== undefined`; body kosong → `findOne`; `lines` → replace. |
| `remove(id)` | `repository.remove`. |

---

## 5. Endpoint & Permission

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta: { page, limit, total }, message }`.

| Method | Path | Akses | Response sukses | Error |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/billings` | PERMISSION `billing:create` | 201 `{ data: <billing>, message }` | 409, 422, 401/403 |
| GET | `/api/v1/billings` | PERMISSION `billing:read` | 200 `{ data: [billing], meta, message }` | 422, 401/403 |
| GET | `/api/v1/billings/:id` | PERMISSION `billing:read` | 200 `{ data: <billing>, message }` | 404, 400 UUID invalid, 401/403 |
| PATCH | `/api/v1/billings/:id` | PERMISSION `billing:update` | 200 `{ data: <billing>, message }` | 404, 409, 422, 401/403 |
| DELETE | `/api/v1/billings/:id` | PERMISSION `billing:delete` | 200 `{ data: <billing>, message }` | 404, 400 UUID invalid, 401/403 |

### Contoh query

- `GET /api/v1/billings?page=1&limit=20&sortBy=total&sortOrder=desc`
- `GET /api/v1/billings?search=INV`
- `GET /api/v1/billings?filter[status]=PAID&filter[paidAt][gte]=2026-09-01T00:00:00Z`

### Contoh body create

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "subscriptionId": "550e8400-e29b-41d4-a716-446655440001",
  "code": "INV-2026-0001",
  "subscriptionType": "MONTHLY",
  "currency": "EUR",
  "total": 120.5,
  "lines": [{ "description": "Paket bulanan", "type": "ITEM", "qty": 1, "amount": 120.5, "currency": "EUR" }]
}
```

---

## 6. Error & Exception

| Exception | Status | Penyebab |
| --- | --- | --- |
| `NotFoundException` | 404 | billing tidak ditemukan |
| `ConflictException` | 409 | `code` sudah dipakai (`P2002`) |
| `UnprocessableEntityException` | 422 | validasi DTO / sortBy / filter |
| `BadRequestException` | 400 | `ParseUUIDPipe` — `:id` bukan UUID valid |
| `UnauthorizedException` | 401 | JWT tidak ada / invalid |
| `ForbiddenException` | 403 | permission kurang |
