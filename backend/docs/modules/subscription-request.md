# Module: Subscription Request

Menu: [subscription.md](./subscription.md) · [billing.md](./billing.md) (tujuan approve) · [rbac.md](./rbac.md) (master)

> **STATUS: DIIMPLEMENTASIKAN (backend).** Antrean permintaan langganan (`subscription_requests`) terpisah dari `billings`. Publik anonim (`@Public()`) **atau** member login mengajukan; admin review → approve/reject. Approve otomatis membuat `Billing` **PAID** lewat `BillingService.subscribe` (member langsung aktif). 3 permission `subscription-request:*` untuk `admin`.

---

## 1. Deskripsi & Lokasi

Permintaan langganan disimpan di **tabel terpisah** `subscription_requests` — **tidak** menulis ke `billings` kecuali saat approve. Relasi:

- `SubscriptionRequest.userId → User.id` (nullable, `onDelete: SetNull`) — pemohon bila login; `null` untuk submit publik.
- `SubscriptionRequest.reviewedById → User.id` (nullable, admin reviewer, `onDelete: SetNull`).
- `SubscriptionRequest.subscriptionId → Subscription.id` (wajib, `onDelete: Restrict`).
- `SubscriptionRequest.billingId → Billing.id` (nullable unik, hasil approve, `onDelete: SetNull`).

```
libs/src/modules/subscription-request/
├── subscription-request.repository.ts
├── subscription-request.service.ts
├── subscription-request.module.ts
├── dto/
│   ├── create-public-subscription-request.dto.ts
│   ├── create-my-subscription-request.dto.ts
│   ├── list-subscription-requests-query.dto.ts
│   ├── review-subscription-request.dto.ts
│   └── approve-subscription-request.dto.ts
└── entities/
    └── subscription-request.entity.ts

apps/app/src/controllers/subscription-requests.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

### Migration

| Migration | Isi |
| --- | --- |
| `20261010130000_add_subscription_requests` | enum `SubscriptionRequestStatus` (`PENDING`/`APPROVED`/`REJECTED`) + `SubscriptionRequestType` (`NEW`/`RENEWAL`); tabel `subscription_requests` + index (`user_id`, `subscription_id`, `status`, `email`) + unique `billing_id`; FK ke `users`/`subscriptions`/`billings`. |

Jalankan `pnpm prisma:seed` untuk menambah 3 permission `subscription-request:*`.

> **Catatan drift:** `pnpm prisma migrate dev` menolak jalan (sebagian migrasi lama dimodifikasi setelah diapply → Prisma minta `migrate reset` destruktif). Migration di atas dibuat lalu diterapkan dengan `pnpm prisma:migrate:deploy` (aman, tanpa reset).

---

## 2. Model Prisma

```prisma
enum SubscriptionRequestStatus { PENDING  APPROVED  REJECTED }
enum SubscriptionRequestType   { NEW      RENEWAL }

model SubscriptionRequest {
  id             String                    @id @default(uuid())
  userId         String?                   @map("user_id")
  user           User?                     @relation("SubscriptionRequester", fields: [userId], references: [id], onDelete: SetNull)
  fullName       String                    @map("full_name")
  email          String
  phone          String?
  website        String?
  address        String?
  country        String?
  organisation   String?
  reason         String                    @db.Text
  subscriptionId String                    @map("subscription_id")
  subscription   Subscription              @relation(fields: [subscriptionId], references: [id], onDelete: Restrict)
  requestType    SubscriptionRequestType   @default(NEW) @map("request_type")
  status         SubscriptionRequestStatus @default(PENDING)
  reviewedById   String?                   @map("reviewed_by_id")
  reviewedBy     User?                     @relation("SubscriptionRequestReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)
  reviewedAt     DateTime?                 @map("reviewed_at")
  reviewNote     String?                   @map("review_note")
  billingId      String?                   @unique @map("billing_id")
  billing        Billing?                  @relation(fields: [billingId], references: [id], onDelete: SetNull)
  createdAt      DateTime                  @default(now()) @map("created_at")
  updatedAt      DateTime                  @updatedAt @map("updated_at")

  @@index([userId]) @@index([subscriptionId]) @@index([status]) @@index([email])
  @@map("subscription_requests")
}
```

`requestType` dihitung: `RENEWAL` bila pemohon login masih punya membership aktif (`Billing.status = PAID` & `expiryDate > now`), selain itu `NEW`. Submit publik default `NEW` (boleh di-set eksplisit).

---

## 3. Entity Payload Type

```typescript
// libs/src/modules/subscription-request/entities/subscription-request.entity.ts
export const subscriptionRequestSelect = {
  id, fullName, email, phone, website, address, country, organisation, reason,
  requestType, status, reviewedAt, reviewNote, billingId,
  subscription: { select: { id, name, slug, subscriptionType, currency, price, durationInDays } },
  user: { select: { id, fullName, email } },
  reviewedBy: { select: { id, fullName } },
  createdAt, updatedAt,
} satisfies Prisma.SubscriptionRequestSelect;
```

- `subscription.price` (`Decimal`) → `number` via `mapSubscriptionRequest`.
- `deletedAt` tidak relevan (tak ada soft-delete).

---

## 4. DTO / Validasi

Status validasi gagal = **422** (RULES bab 7). `@Param('id')` selalu `ParseUUIDPipe`.

`CreatePublicSubscriptionRequestDto` (mirror `CreatePublicEventDto`):

| Field | Aturan |
| --- | --- |
| `fullName` | trim, `@IsNotEmpty`, `@MaxLength(200)` |
| `email` | trim+lowercase, `@IsEmail`, `@MaxLength(200)` |
| `phone?` | `@IsString`, `@MaxLength(50)` |
| `website?` | `@IsUrl`, `@MaxLength(2048)` |
| `address?` | `@IsString`, `@MaxLength(500)` |
| `country?` | `@IsString`, `@MaxLength(100)` |
| `organisation?` | `@IsString`, `@MaxLength(200)` |
| `reason` | trim, `@IsNotEmpty`, `@MaxLength(2000)` |
| `subscriptionId` | `@IsUUID` |
| `requestType?` | `@IsEnum(SubscriptionRequestType)` |

`CreateMySubscriptionRequestDto`: sama, **tanpa** `fullName`/`email` (diambil dari user login) + `requestType` tidak diterima (server hitung).

`ReviewSubscriptionRequestDto`: `note?` (`@IsOptional`, `@IsString`, `@MaxLength(1000)`, trim) — dipakai endpoint reject.

`ApproveSubscriptionRequestDto`: `note?` (trim, max1000) + `paymentProofUrl?` (`@IsString`, max2048) + `paymentProofName?` (trim, `@IsString`, max500) — dipakai endpoint approve. Bukti pembayaran opsional; trust-boundary URL divalidasi di `BillingService.subscribe`.

`ListSubscriptionRequestsQueryDto extends ListQueryDto`.

### Konstanta list

| Konstanta | Nilai |
| --- | --- |
| `SUBSCRIPTION_REQUEST_SEARCHABLE_FIELDS` | `['fullName', 'email', 'organisation']` |
| `SUBSCRIPTION_REQUEST_SORT_FIELDS` | `['fullName', 'email', 'status', 'requestType', 'createdAt', 'updatedAt', 'reviewedAt', 'subscription.name']` |
| `SUBSCRIPTION_REQUEST_FILTER_FIELDS` | `['status', 'requestType', 'userId', 'subscriptionId', 'email', 'createdAt', 'updatedAt']` |
| `SUBSCRIPTION_REQUEST_DATE_FIELDS` | `['createdAt', 'updatedAt', 'reviewedAt']` |
| `SUBSCRIPTION_REQUEST_SORT_MAP` | `{ 'subscription.name': 'subscription.name' }` |

`filter[status]`/`filter[requestType]` divalidasi enum → nilai tak valid 422. `page` default 1, `limit` default 20 (clamp 100).

---

## 5. Repository & Service

### Repository

| Method | Fungsi |
| --- | --- |
| `findById(id)` | `findUnique` select entity; tidak ada → `NotFoundException('Subscription request not found')`. |
| `findForReview(id)` | select minimum (`id, status, userId, subscriptionId, fullName, email`) untuk keputusan review. |
| `findMany({ where, skip, take, orderBy })` | List paginated (`$transaction`). |
| `create(data)` | `create` (unchecked, `userId` nullable). |
| `claimPending(id, data)` | **atomic**: `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', ... } })` → `{ count }`. |
| `claimRejected(id, data)` | **atomic**: `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', ... } })` → `{ count }`. |
| `setBillingId(id, billingId)` | set `billingId`; return entity. |
| `revertPending(id)` | rollback: `status=PENDING`, `billingId/reviewedById/reviewedAt/reviewNote=null`. |
| `findActiveSubscription(id)` | cross-table: `subscription.findFirst({ id, deletedAt: null, status: 'ACTIVE' })` → `{ id } | null`. |
| `findUserContact(id)` | cross-table: `user.findUnique` (`fullName,email,phone,address,roleId`). |
| `findRoleIdByCode(code)` | cross-table: `role.findUnique` → `{ id } | null`. |
| `setUserRole(userId, roleId)` | cross-table: `user.update({ roleId })`. |

### Service

| Method | Fungsi |
| --- | --- |
| `createPublic(dto)` | validasi subscription aktif (422 per-field bila tidak) → simpan `PENDING`, `userId=null`; `notifyAdmins` (`SUBSCRIPTION_REQUEST_SUBMITTED`, title `fullName - subscription.name`, link `/subscription-requests/{id}`) setelah row dibuat; return `{ id, status }`. |
| `createMine(userId, dto)` | user wajib ada (404); `requestType` = `RENEWAL` bila `BillingService.hasActiveMembership` else `NEW`; identitas dari user, kontak fallback ke `user.phone`/`user.address`; setelah row dibuat → `notifyAdmins` yang sama. |
| `listMine(userId, query)` | `list` dengan `filter[userId]` ditimpa; default sort `createdAt desc`. |
| `list(query)` | `buildWhere` + `buildSearch` + `combineWhere` + `buildOrderBy` (pola `BillingService.list`). |
| `findOne(id)` | `repository.findById`. |
| `approve(id, reviewerId, input?)` | lihat §6. `input` = `{ note?, paymentProofUrl?, paymentProofName? }` (kompatibel: `input` opsional). |
| `reject(id, reviewerId, note?)` | **atomic claim** `claimRejected` (`updateMany where { id, status: PENDING }`) + count check; `count === 0` → `findById` (404 bila hilang) else **409**. |

---

## 6. Logika Approve (atomic claim + compensating rollback)

1. Load request (`findForReview`) → **404** bila tak ada.
2. **Atomic claim**: `claimPending(id, { reviewedById, reviewedAt, reviewNote })` = `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', ... } })`. Bila `count === 0` → `findById` dulu untuk pesan tepat: baris hilang → **404** `NotFoundException('Subscription request not found')`; ada tapi bukan `PENDING` → **409** `ConflictException('Subscription request is not pending')`. Ini yang mencegah dua approve paralel menghasilkan 2 billing PAID.
3. Subscription aktif & belum soft-deleted → **404** `NotFoundException('Subscription not found')` bila hilang.
4. Resolve user:
   - `request.userId` ada → `findUserContact`.
   - else → `UserService.findOrCreatePublicUser({ fullName, email })` (buat user login-less, password acak).
   - Role `member` **hanya** di-set bila `roleId` user masih `null` — alasan: **jangan downgrade role existing** (mis. admin/author yang mengajukan tetap role-nya). `ponytail:` catat ceiling ini (user ber-role selain `member` tidak dipaksa jadi `member`; upgrade bila perlu penegakan eksplisit).
5. `BillingService.subscribe({ userId, subscriptionId, paymentProofUrl?, paymentProofName? })` → ambil `billing.id`. Billing **PAID** dibuat di sini (proses subscription terjadi setelah approve). Bukti pembayaran opsional: trust-boundary dicek `BillingService.subscribe` (prefix `S3_PUBLIC_BASE_URL` → **422** `paymentProofUrl`). Karena panggilan ada di dalam `try`, kegagalan bukti otomatis `revertPending` → request kembali `PENDING`.
6. `setBillingId(id, billing.id)` → return entity terbaru.
7. **Compensating rollback**: bila langkah 3–6 throw, `revertPending(id)` mengembalikan `status=PENDING` + `billingId/reviewedById/reviewedAt/reviewNote = null`, lalu error di-rethrow → menutup **orphan billing**.

> `ponytail:` claim (langkah 2) + create billing (langkah 5) + setBillingId (langkah 6) **belum** satu `prisma.$transaction`; rollback manual menutup jendela orphan. Upgrade ke transaksi tunggal bila butuh atomik penuh (perlu menyerahkan `tx` ke `BillingService`).

---

## 7. Endpoint & Permission

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta: { page, limit, total }, message }`.

| Method | Path | Akses | Body | Respons |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/subscription-requests` | `@Public()` + Throttle 5/menit | `CreatePublicSubscriptionRequestDto` | 201 `{ data: { id, status }, message }` |
| POST | `/api/v1/subscription-requests/me` | LOGIN-only | `CreateMySubscriptionRequestDto` | 201 `{ data: <request>, message }` |
| GET | `/api/v1/subscription-requests/me` | LOGIN-only | — | 200 `{ data: [request], meta, message }` (milik user) |
| GET | `/api/v1/subscription-requests` | PERMISSION `subscription-request:read` | — | 200 `{ data: [request], meta, message }` |
| GET | `/api/v1/subscription-requests/:id` | PERMISSION `subscription-request:read` | — | 200 `{ data: <request>, message }` |
| POST | `/api/v1/subscription-requests/:id/approve` | PERMISSION `subscription-request:approve` | `{ note?, paymentProofUrl?, paymentProofName? }` | 200 `{ data: <request>, message }` |
| POST | `/api/v1/subscription-requests/:id/reject` | PERMISSION `subscription-request:reject` | `{ note? }` | 200 `{ data: <request>, message }` |

> Route statis (`me`, `:id/approve`, `:id/reject`) dideklarasikan **sebelum** `:id` agar tidak tertelan `ParseUUIDPipe` (pola `subscriptions.controller.ts`).

### Contoh query

- `GET /api/v1/subscription-requests?page=1&limit=10&filter[status]=PENDING&sortBy=createdAt&sortOrder=desc`
- `GET /api/v1/subscription-requests?filter[requestType]=RENEWAL&search=jane`
- `GET /api/v1/subscription-requests?sortBy=subscription.name&sortOrder=asc`

---

## 8. Error & Exception

| Exception | Status | Penyebab |
| --- | --- | --- |
| `UnprocessableEntityException` | 422 | validasi DTO; `subscriptionId` tak ada / tidak `ACTIVE` / soft-deleted; sortBy/filter tak dikenal |
| `NotFoundException` | 404 | request / user / subscription tidak ditemukan |
| `ConflictException` | 409 | approve/reject pada request non-`PENDING` |
| `UnauthorizedException` | 401 | JWT tidak ada / invalid (endpoint `/me`, admin) |
| `ForbiddenException` | 403 | permission kurang |

---

## 9. Verifikasi

```bash
# submit publik
curl -X POST "$API_BASE_URL/subscription-requests" -H "Content-Type: application/json" \
  -d '{"fullName":"Jane Doe","email":"jane@example.com","reason":"Ingin jadi member","subscriptionId":"<uuid>"}'

# review admin
curl "$API_BASE_URL/subscription-requests?filter[status]=PENDING" -H "Authorization: Bearer $TOKEN"
curl -X POST "$API_BASE_URL/subscription-requests/<id>/approve" -H "Authorization: Bearer $TOKEN" -d '{"note":"ok"}'
curl -X POST "$API_BASE_URL/subscription-requests/<id>/reject"  -H "Authorization: Bearer $TOKEN" -d '{"note":"tidak lengkap"}'
```

```bash
pnpm prisma migrate dev --name add_subscription_requests   # jika riwayat migrasi bersih; jika drift → prisma migrate deploy
pnpm prisma:generate
pnpm prisma:seed
pnpm tsc --noEmit
pnpm run build
npx jest libs/src/modules/subscription-request
```

> Unit test `subscription-request.service.spec.ts`: approve sukses (claim atomik → billing → `billingId`), approve kedua pada request `APPROVED` → **409**, dan rollback ke `PENDING` saat billing gagal.
