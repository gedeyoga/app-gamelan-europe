# Module: Billing

Menu: [subscription.md](./subscription.md)

> **STATUS: DIIMPLEMENTASIKAN (backend).** CRUD `Billing` + `BillingLine` tersedia, ditambah **Billing Management** langganan member (`GET /billings/members`, `POST /billings/subscribe`, `POST /billings/:id/cancel`). Model `Billing`/`BillingLine` sudah ada sejak migration init repo; modul ini menambah entity/service/controller + 4 permission `billing:*` serta beberapa migration lanjutan (lihat §1).

---

## 1. Deskripsi & Lokasi

Modul **`billing`** mengelola `Billing` (tagihan) beserta `BillingLine` (rincian baris). Relasi:

- `Billing.userId → User.id` (wajib, `onDelete: Cascade`)
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

`BillingModule` meng-`import` `NotificationModule` (emisi `SUBSCRIPTION_ACTIVE`); `NotificationModule` **tidak** mengimpor `BillingModule` (arah dependensi satu arah, tanpa siklus/`forwardRef`).

### Migration

Jalankan `pnpm prisma:migrate:deploy` (produksi) / `pnpm prisma:migrate:dev` (lokal). Migration lanjutan terkait billing/subscription:

| Migration | Isi |
| --- | --- |
| `20261007000000_add_subscription_price_duration` | `subscriptions.price` (`DECIMAL(12,2)`), `subscriptions.duration_in_days` (`INTEGER`) — dipakai `POST /billings/subscribe`. |
| `20261007010000_add_subscription_status` | enum `SubscriptionStatus` + `subscriptions.status` (default `ACTIVE`). |
| `20261007020000_drop_billing_network` | `billings` lepas kolom `network_id` + FK/index-nya. |
| `20261007030000_add_billing_start_expiry_dates` | `billings.start_date` & `billings.expiry_date` (`TIMESTAMP(3)`, nullable) — dipakai `subscribe` & list member. |
| `20261008000000_add_billing_payment_proof` | `billings.payment_proof_url` & `billings.payment_proof_name` (`TEXT`, nullable) — bukti bayar langganan. |

Jalankan `pnpm prisma:seed` untuk menambah 4 permission `billing:*`.

---

## 2. Entity Payload Type

```typescript
// libs/src/modules/billing/entities/billing.entity.ts
export const billingSelect = {
  id: true, userId: true, subscriptionId: true,
  code: true, status: true, subscriptionType: true, currency: true,
  total: true, discount: true, tax: true, paidAt: true, canceledAt: true,
  startDate: true, expiryDate: true,
  paymentProofUrl: true, paymentProofName: true,
  user: { select: { id: true, fullName: true, email: true, avatar: true } },
  subscription: { select: { id: true, name: true, slug: true } },
  lines: { select: { id: true, description: true, type: true, qty: true, amount: true, currency: true } },
  createdAt: true, updatedAt: true,
} satisfies Prisma.BillingSelect;
```

- `total` → `number`; `discount`/`tax` → `number | null`; `lines[].amount` → `number`.
- `startDate`/`expiryDate` (`Date | null`) → dibiarkan; serialisasi JSON jadi ISO. `user.avatar` (`string | null`).
- Model `Billing` punya kolom `start_date`/`expiry_date` (ditambah via `20261007030000_add_billing_start_expiry_dates`) — dipakai `POST /billings/subscribe`.
- `paymentProofUrl`/`paymentProofName` (`string | null`) — URL & nama file bukti bayar; diisi dari `POST /billings/payment-proof` lalu diteruskan ke `subscribe`.

### Payload member (`/billings/members`)

`memberSelect` (di `billing.entity.ts`) = user (`id`, `fullName`, `email`, `avatar`, `createdAt`) + `billings` terbaru (`orderBy createdAt desc, take 1`). `mapMemberSubscription(row, now)` menghasilkan:

```typescript
interface MemberSubscription {
  userId: string;
  user: { id: string; fullName: string; email: string; avatar: string | null };
  billingId: string | null;
  startDate: string | null;    // ISO
  expiryDate: string | null;   // ISO
  subscription: { id: string; name: string; slug: string } | null;
  status: 'ACTIVE' | 'INACTIVE' | 'NONE';
}
```

`status` **dihitung** (bukan kolom DB): `NONE` bila user tak punya billing; `ACTIVE` bila billing terbaru `status = PAID` **dan** `expiryDate > now`; selain itu `INACTIVE` (termasuk `PENDING`/`CANCELED` atau `expiryDate` null/lewat).

---

## 3. DTO / Validasi

`CreateBillingDto`:

| Field | Aturan |
| --- | --- |
| `userId` | `@IsUUID()` wajib |
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
| `discount`, `tax` | create: skip (default null) · update: tidak disentuh | **clear** → `null` |
| `paidAt`, `canceledAt` | create: skip (default null) · update: tidak disentuh | **clear** → `null` (bukan `new Date(null)`) |

`userId`/`subscriptionId` **wajib non-null** (tanpa `@IsOptional()`; `null` → 422). String non-null untuk `paidAt`/`canceledAt` dikonversi `new Date(iso)`.

### Konstanta list

| Konstanta | Nilai |
| --- | --- |
| `BILLING_SEARCHABLE_FIELDS` | `['code', 'currency']` |
| `BILLING_SORT_FIELDS` | `['code', 'status', 'subscriptionType', 'currency', 'total', 'paidAt', 'canceledAt', 'startDate', 'expiryDate', 'createdAt', 'updatedAt', 'user.fullName', 'subscription.name']` |
| `BILLING_FILTER_FIELDS` | `['code', 'status', 'subscriptionType', 'currency', 'userId', 'subscriptionId', 'paidAt', 'canceledAt', 'startDate', 'expiryDate', 'createdAt', 'updatedAt']` |
| `BILLING_DATE_FIELDS` | `['paidAt', 'canceledAt', 'startDate', 'expiryDate', 'createdAt', 'updatedAt']` |
| `MEMBER_SORT_FIELDS` | `['fullName', 'user.fullName', 'email', 'subscription.name', 'startDate', 'expiryDate', 'status', 'createdAt']` (default `fullName` asc) |

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
| `findMembers(where)` | `user.findMany` (cross-table read: user + `role` + `billings` terbaru `take 1`). |
| `findUser(id)` | `findUnique`; tidak ada → `NotFoundException('User not found')`. |
| `findSubscription(id)` | `subscription.findFirst({ id, deletedAt: null })`; tidak ada → `NotFoundException('Subscription not found')`. |
| `subscribe(input)` | Transaksi: `billing.updateMany` billing `PAID` lama user → `CANCELED` + `canceledAt` + `expiryDate = null`; `billing.create` PAID. `code` di-generate; `P2002` → retry sekali (code baru); bentrok kedua → `ConflictException` 409 via `mapUnique`. |
| `cancel(id)` | Pre-check → 404; set `status = CANCELED`, `canceledAt = now`, `expiryDate = null`. |

> **Reset `expiryDate`**: baik `cancel(id)` maupun pembatalan otomatis billing `PAID` lama di `subscribe(input)` mengirim `expiryDate: null` (bukan hanya `status`). `startDate` tidak disentuh. Akibatnya member tampil `INACTIVE` dengan `expiryDate: null` (FE render `—`).

### Service

| Method | Fungsi |
| --- | --- |
| `list(query)` | `buildWhere` (enum `status`/`subscriptionType` + date) + `buildSearch` + `combineWhere` + `buildOrderBy`. |
| `findOne(id)` | `repository.findById`. |
| `create(dto)` | Bangun `BillingCreateInput` (`connect` user/subscription, nested lines). Setelah tersimpan `status = PAID` + `expiryDate` → `notifySubscriptionActive` (best-effort). |
| `update(id, dto)` | Kumpulkan field `!== undefined`; body kosong → `findOne`; `lines` → replace. Hasil akhir `status = PAID` → `notifySubscriptionActive` (best-effort; `PAID→PAID` aman, dedupe unique key DB). |
| `remove(id)` | `repository.remove`. |
| `listMembers(query)` | `assertAllowedSort(MEMBER_SORT_FIELDS)` + `buildSearch(fullName/email)` + `combineWhere({ role: { code: 'member' } })`; map `status` komputasi; sort & paginasi in-memory. |
| `subscribe(dto)` | Cek subscription & user (404), hitung `expiryDate = now + durationInDays`, delegasi `repository.subscribe`; teruskan `paymentProofUrl`/`paymentProofName` bila ada. Hasil `PAID` → `NotificationService.notifySubscriptionActive` best-effort (satu-satunya jalur approve subscription request). |
| `uploadPaymentProof(file)` | Validasi file ada + MIME (`image/jpeg`/`png`/`webp`/`pdf`, normalkan `octet-stream` via ekstensi) + ukuran; simpan ke `StorageService` `billing/payment-proof/<uuid>.<ext>`; kembalikan `{ url, filename, mimeType, size }` (tanpa DB). |
| `findSubscriptionLifecycleRows(now)` | Dua window notifikasi (`expiring`, `expired`) via `BillingRepository.findExpiringSubscriptions`/`findExpiredSubscriptions` — dipakai worker (`NotificationService.enqueueSubscriptionLifecycle`). |
| `cancel(id)` | `repository.cancel`. |

> **Sort/paginasi member in-memory** (`ponytail:` ditandai di service): `status` & `expiryDate` berasal dari billing terbaru (bukan kolom user) → Prisma tak bisa `orderBy` langsung. Upgrade ke SQL (window/join) bila populasi member besar.

---

## 5. Endpoint & Permission

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta: { page, limit, total }, message }`.

| Method | Path | Akses | Response sukses | Error |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/billings` | PERMISSION `billing:create` | 201 `{ data: <billing>, message }` | 409, 422, 401/403 |
| GET | `/api/v1/billings` | PERMISSION `billing:read` | 200 `{ data: [billing], meta, message }` | 422, 401/403 |
| GET | `/api/v1/billings/me` | LOGIN-only | 200 `{ data: [billing], meta, message }` | 422, 401 |
| GET | `/api/v1/billings/members` | PERMISSION `billing:read` | 200 `{ data: MemberSubscription[], meta, message }` | 422, 401/403 |
| POST | `/api/v1/billings/subscribe` | PERMISSION `billing:create` | 201 `{ data: <billing>, message }` | 404 user/subscription, 422, 401/403 |
| POST | `/api/v1/billings/payment-proof` | PERMISSION `billing:create` | 201 `{ data: { url, filename, mimeType, size }, message }` | 422 (MIME/ukuran), 401/403 |
| GET | `/api/v1/billings/:id` | PERMISSION `billing:read` | 200 `{ data: <billing>, message }` | 404, 400 UUID invalid, 401/403 |
| PATCH | `/api/v1/billings/:id` | PERMISSION `billing:update` | 200 `{ data: <billing>, message }` | 404, 409, 422, 401/403 |
| POST | `/api/v1/billings/:id/cancel` | PERMISSION `billing:update` | 200 `{ data: <billing>, message }` | 404, 400 UUID invalid, 401/403 |
| DELETE | `/api/v1/billings/:id` | PERMISSION `billing:delete` | 200 `{ data: <billing>, message }` | 404, 400 UUID invalid, 401/403 |

> **Urutan route**: `GET /billings/members` didaftarkan **sebelum** `GET /billings/:id` (juga `/billings/me`) agar tidak tertelan `ParseUUIDPipe` (route statis menang di atas param).

### Billing Management (langganan member)

- `GET /billings/members` — hanya user `role.code === 'member'` (admin/author dikecualikan). Query: `page, limit, search, sortBy, sortOrder`. `search` cocok `fullName`/`email` (contains, case-insensitive). `sortBy` ∈ `fullName|user.fullName|email|subscription.name|startDate|expiryDate|status|createdAt` (default `fullName` asc; `user.fullName` setara `fullName`).
- `POST /billings/subscribe` — body `{ userId: UUID, subscriptionId: UUID, paymentProofUrl?: string (max 2048), paymentProofName?: string (max 255) }`. Transaksi atomik: billing `PAID` lama milik user → `CANCELED` (`canceledAt = now`), lalu billing baru `status = PAID`, `paidAt = now`, `startDate = now`, `expiryDate = now + subscription.durationInDays hari`, `subscriptionType`/`currency` dari `Subscription`, `total = subscription.price`; `paymentProofUrl`/`paymentProofName` disimpan bila ada. `code` (`INV-<yyyyMMdd>-<6 hex>`) di-retry sekali bila bertabrakan; bentrok kedua → 409 (bukan 500).
- `POST /billings/:id/cancel` — set `status = CANCELED`, `canceledAt = now`; billing tak ada → 404.

> **Notifikasi PAID**: billing yang menjadi `PAID` (lewat `POST /billings`, `PATCH /billings/:id`, `POST /billings/subscribe`, atau approve subscription request) memicu email `SUBSCRIPTION_ACTIVE` ke member (`userId` + `expiryDate` wajib ada). Emisi di `BillingService`, best-effort (tidak menggagalkan write), idempoten via unique `(userId, type, entityType, entityId)`.

### Upload bukti bayar

- `POST /billings/payment-proof` — multipart, field **`file`** (1 file). MIME diterima: `image/jpeg`, `image/png`, `image/webp`, `application/pdf` (plus `application/octet-stream`/kosong bila ekstensi cocok). Maks **10 MB** (`UPLOAD_DOCUMENT_MAX_SIZE_MB`, default 10). MIME salah / file terlalu besar / file kosong → **422** `{ message: 'Validation failed', errors: [{ field: 'file', message }] }` (dipetakan oleh `PaymentProofUploadInterceptor`).
- Disimpan via `StorageService.upload` dengan `key = billing/payment-proof/<uuid>.<ext>` (ext dari MIME); **tanpa baris DB**. `url = ${S3_PUBLIC_BASE_URL}/${key}` (pola `DocumentService.toDocumentUrl`). Response `{ data: { url, filename, mimeType, size }, message }` — FE meneruskan `url`/`filename` sebagai `paymentProofUrl`/`paymentProofName` ke `subscribe`.

### Contoh query

- `GET /api/v1/billings/members?page=1&limit=20&sortBy=expiryDate&sortOrder=asc&search=andi`
- `POST /api/v1/billings/subscribe` body `{ "userId": "…", "subscriptionId": "…" }`
- `POST /api/v1/billings/<id>/cancel`

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
| `NotFoundException` | 404 | billing / user / subscription tidak ditemukan (`subscribe`, `cancel`, `members` user hilang) |
| `ConflictException` | 409 | `code` sudah dipakai (`P2002`) — CRUD; `subscribe` retry sekali untuk `P2002`, bentrok kedua → 409. |
| `UnprocessableEntityException` | 422 | validasi DTO / sortBy / filter |
| `BadRequestException` | 400 | `ParseUUIDPipe` — `:id` bukan UUID valid |
| `UnauthorizedException` | 401 | JWT tidak ada / invalid |
| `ForbiddenException` | 403 | permission kurang |
