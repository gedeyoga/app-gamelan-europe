# Module: Billing — Brief

Dokumen ini mencatat desain/implementasi halaman **Billing Management** pada frontend React — CRUD lengkap billing (list paginated, create, update, delete, field array `lines`). Mengikuti konvensi `frontend/AGENTS.md` dan format brief `docs/module/user.md`.

## 1. Tujuan & Ruang Lingkup

- Menyediakan **CRUD billing**: daftar (pagination), tambah, edit, hapus. Form mencakup relasi user/organization/subscription, status, tanggal bayar/batal, dan baris (`lines`).
- Konsumsi API `/api/v1/billings` (kontrak BE dibuat paralel), JWT Bearer + permission `billing:*`.
- Data opsi form diambil dari feature lain di **container** (route), bukan di komponen fitur (menjaga larangan import lintas fitur): `useUsers`/`useOrganizations`/`useSubscriptions` (`{page:1,limit:100}`), **lazy** — `enabled: formOpen && can('<resource>:read')`, jadi user tanpa permission terkait tidak memicu 403 saat mount. Bila permission tak ada, select terkait di-disable + placeholder "—" (tidak fetch).

## 2. Routing

- Route: `/billings`, nested di bawah `/` protected, dibungkus `<RequirePermission code="billing:read">`.
- Container page: `src/app/routes/billings.tsx` (`BillingsPage`).

```
/billings  → halaman CRUD Billing Management
```

## 3. Struktur File

```
src/app/routes/billings.tsx               # container + fetch opsi user/organization/subscription

src/features/billing/
├── types.ts                              # Billing, BillingLine, Create/UpdateBillingInput, konstanta
├── api/billings.ts                       # listBillings, create/update/delete
├── hooks/
│   ├── use-billings.ts                   # query ['billings', {...}]
│   ├── use-create-billing.ts
│   ├── use-update-billing.ts
│   └── use-delete-billing.ts
└── components/
    ├── billing-table.tsx                 # code, user, subscription, status, total, createdAt
    ├── billing-form-dialog.tsx           # RHF + zod + useFieldArray lines + DateTimePicker
    └── delete-billing-dialog.tsx
```

## 4. Kontrak API

| Endpoint | Body | Keterangan |
| --- | --- | --- |
| `POST /billings` | `{ userId, organizationId?, subscriptionId, code, status?, subscriptionType, currency, total, discount?, tax?, paidAt?, canceledAt?, lines[] }` | `lines[]` = `{ description, type, qty?, amount, currency }`. |
| `GET /billings?page=&limit=` | — | list paginated. |
| `GET /billings?search=&sortBy=&sortOrder=` | — | search OR like `code,currency`; <2 char diabaikan. |
| `PATCH /billings/:id` | field opsional | `lines` = **replace seluruh baris**. Field opsional (`organizationId`, `discount`, `tax`, `paidAt`, `canceledAt`) dikirim `null` eksplisit saat kosong → backend **clear/disconnect**; `undefined` (di-omit) = biarkan. |
| `DELETE /billings/:id` | — | hapus. |

BillingEntity: `{ id, userId, user, organizationId|null, organization|null, subscriptionId, subscription, code, status, subscriptionType, currency, total, discount|null, tax|null, paidAt|null, canceledAt|null, lines[], createdAt, updatedAt }`; `lines` item `{ id, description, type:'ITEM'|'DISCOUNT'|'TAX', qty, amount, currency }`.

### Searchable / Sortable

- **Searchable**: `code`, `currency`. Placeholder: "Cari kode atau mata uang...".
- **Sortable** (semua kolom tampil): `code`, `user.fullName`, `subscription.name`, `status`, `total`, `createdAt` (+ `subscriptionType`, `currency`, `paidAt`, `canceledAt`, `updatedAt`). Backend memetakan sort relasi via `BILLING_SORT_MAP`.
- Contoh query: `GET /api/v1/billings?page=1&limit=10&search=INV&sortBy=user.fullName&sortOrder=asc`.

## 5. Form & Tanggal

- Field: `code*`, `user` (Select), `organization` (Select opsional, sentinel `none` → `organizationId: null`), `subscription*` (Select), `status` (Select), `subscriptionType` (Select), `currency*`, `total*`, `discount`, `tax`, `paidAt`, `canceledAt`, `lines` (field array RHF: description, type Select, qty, amount, currency; tombol tambah/hapus baris).
- Angka (`total`, `discount`, `tax`, `qty`, `amount`) disimpan sebagai string di form lalu dikonversi (`Number`) saat submit. `discount`/`tax` kosong → `null` (clear); `qty` kosong → di-omit (bukan `NaN`).
- Field opsional kosong dikirim `null` eksplisit: `organizationId`, `discount`, `tax`, `paidAt`, `canceledAt`. Select user/organization/subscription di-disable + placeholder "—" bila sesi tak punya permission baca terkait.
- `paidAt`/`canceledAt` memakai `components/shared/date-time-picker.tsx`; dikirim ISO UTC (`value` sudah ISO dari picker). Dilarang `<input type="date">`.
- 422 → `mapApiFieldErrors` → `form.setError` (mendukung path bersarang `lines.N.field`), tanpa toast, dialog tetap terbuka.
- Toast call-site: `billing:toast.created/updated/deleted` + `*Failed`.

## 6. Permissions

| Route / Aksi | Kode |
| --- | --- |
| Route `/billings` | `billing:read` |
| Tombol Tambah | `billing:create` |
| Edit | `billing:update` |
| Hapus | `billing:delete` |
| Menu sidebar "Billing Management" | `billing:read` |

## 7. Status & Catatan

- **Selesai**: CRUD + pagination + search + sort server-side + skeleton + forbidden state + permission gating (termasuk lazy fetch opsi form) + field array lines.
- **Kontrak terkonfirmasi/terimplementasi (BE)**:
  - Endpoint `/subscriptions` & `/billings` tersedia.
  - Enum `status`/`subscriptionType`/`type` line; `total` number; `qty` optional; 422 error per-field (termasuk path bersarang `lines.N.field`).
  - Semantik `null`: BE map `null` → clear (`discount`/`tax`/`paidAt`/`canceledAt`) & disconnect (`organizationId`); `undefined` → biarkan.
  - Sort relasi `user.fullName`/`subscription.name` didukung via `BILLING_SORT_MAP`.
- Format tampilan `total` memakai `Number.toLocaleString` + kode `currency` (tanpa helper shared — belum ada).
