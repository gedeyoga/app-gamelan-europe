# Module: Subscription Request — Brief

Dokumen ini mencatat desain/implementasi modul **Subscription Request** pada frontend React — antrean admin untuk meninjau permintaan langganan (approve/reject) + alur self-service di `/my-billings`. Mengikuti `frontend/AGENTS.md` dan format brief `docs/module/billing.md`. Kontrak backend **FROZEN** (lihat `backend/docs/modules/subscription-request.md`).

## 1. Tujuan & Ruang Lingkup

- **Admin**: daftar + detail permintaan langganan (dari member maupun publik), dengan aksi kondisional **Approve**/**Reject** (hanya saat `PENDING`).
- **Member**: panel "Permintaan Langganan" + dialog pengajuan di halaman self-service `/my-billings`.
- **Dashboard admin**: section ringkas "Subscription Requests Awaiting Approval" (approve/reject/view).
- Konsumsi API `/api/v1/subscription-requests*`. Endpoint admin (`GET /subscription-requests`, `GET /:id`, `POST /:id/approve|reject`) butuh JWT Bearer + permission `subscription-request:*`. Endpoint self-service `POST|GET /subscription-requests/me` **login-only** (JWT, tanpa permission); `POST /subscription-requests` **publik/anonim** (`@Public()`).

## 2. Routing

- `/subscription-requests` → `SubscriptionRequestsPage` (`src/app/routes/subscription-requests.tsx`), dibungkus `<RequirePermission code="subscription-request:read">`.
- `/subscription-requests/:id` → `SubscriptionRequestDetailPage`, gating approve/reject via `can()` (`subscription-request:approve`/`reject`).
- Halaman self-service tetap `/my-billings` (`MyBillingsPage`) — panel + dialog ditambahkan di sana.

```
/subscription-requests       → antrean admin
/subscription-requests/:id   → detail + approve/reject
/my-billings                 → panel "Permintaan Langganan" + dialog pengajuan
```

## 3. Struktur File

```
src/app/routes/
├── subscription-requests.tsx              # container list: state search/sort/filter + dialog approve/reject + toast
└── subscription-request-detail.tsx        # container detail: gating + dialog approve/reject + toast

src/features/subscription-request/
├── types.ts                               # SubscriptionRequest, payload create-me, opsi paket, konstanta status/type/sortable
├── api/
│   └── subscription-requests.ts           # list / get / approve / reject (admin) + list-me / create-me (self-service)
├── hooks/
│   ├── use-subscription-requests.ts       # query ['subscription-requests', {...}] (enabled, filter, keepPreviousData, staleTime 30s)
│   ├── use-subscription-request.ts        # query ['subscription-request', { id }]
│   ├── use-approve-subscription-request.ts# mutation + invalidate ['subscription-requests'], ['subscription-request',{id}], ['billing'], ['billing-members']
│   ├── use-reject-subscription-request.ts # mutation + invalidate (sama seperti approve)
│   ├── use-my-subscription-requests.ts    # query ['my-subscription-requests', { page, limit }]
│   └── use-create-my-subscription-request.ts # mutation + invalidate ['my-subscription-requests']
└── components/
    ├── subscription-request-table.tsx     # tabel antrean admin (presentational)
    ├── subscription-request-status-badge.tsx # Badge status (label + variant)
    ├── subscription-request-detail-card.tsx  # kartu detail (presentational)
    ├── approve-subscription-request-dialog.tsx # Dialog konfirmasi approve + unggah bukti opsional
    ├── reject-subscription-request-dialog.tsx  # AlertDialog tolak + catatan opsional
    ├── my-subscription-requests-panel.tsx      # panel self-service + tombol ajukan
    └── request-subscription-dialog.tsx         # dialog pengajuan (RHF + zod)

src/features/dashboard/
├── types.ts                               # DashboardPendingSubscriptionRequestItem
└── components/dashboard-pending-subscription-requests.tsx # section ringkas dashboard admin

src/app/routes/dashboard-home.tsx          # section pending subscription requests (approve/reject/view)
```

## 4. Kontrak API

| Endpoint | Permission | Body | Keterangan |
| --- | --- | --- | --- |
| `GET /subscription-requests?page=&limit=&search=&sortBy=&sortOrder=&filter[status]=` | `subscription-request:read` | — | list admin, envelope `{ data: SubscriptionRequest[], meta, message }`. |
| `GET /subscription-requests/:id` | `subscription-request:read` | — | detail. |
| `POST /subscription-requests/:id/approve` | `subscription-request:approve` | `{ note?, paymentProofUrl?, paymentProofName? }` | setujui; bukti opsional (unggah via `POST /billings/payment-proof`). Backend otomatis buat `Billing` PAID. |
| `POST /subscription-requests/:id/reject` | `subscription-request:reject` | `{ note? }` | tolak. |
| `GET /subscription-requests/me?page=&limit=` | login (tanpa permission) | — | list milik user login. |
| `POST /subscription-requests/me` | login (tanpa permission) | `CreateMySubscriptionRequestInput` | ajukan request. |
| `POST /subscription-requests` | publik (`@Public()`) | `CreatePublicSubscriptionRequestDto` | pengajuan anonim dari website EGS (di luar scope FE ini). |

```ts
SubscriptionRequest {
  id: string
  fullName: string; email: string
  phone: string | null; website: string | null; address: string | null
  country: string | null; organisation: string | null
  reason: string
  requestType: 'NEW' | 'RENEWAL'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  subscription: { id; name; slug; subscriptionType; currency; price; durationInDays }
  user: { id; fullName; email } | null
  reviewedBy: { id; fullName } | null
  reviewedAt: string | null; reviewNote: string | null
  billingId: string | null
  createdAt: string; updatedAt: string
}

CreateMySubscriptionRequestInput { subscriptionId: string; reason: string; phone?; website?; address?; country?; organisation? }

ApproveSubscriptionRequestInput { note?: string; paymentProofUrl?: string; paymentProofName?: string }
SubscriptionRequestPaymentProof { url: string; filename: string; mimeType: string; size: number }
```

Helper validasi bukti bersama: `src/lib/payment-proof.ts` (`ACCEPTED_PROOF_MIME`, `ACCEPTED_PROOF_EXT`, `MAX_PROOF_BYTES`, `isAcceptedProofFile`) — dipakai `subscribe-billing-dialog.tsx` (billing) dan dialog approve di modul ini.

### Searchable / Sortable / Filter

- **Searchable** (backend): `fullName`, `email`, `organisation`. Placeholder: "Cari nama, email, atau organisasi...". Dikirim hanya bila trim ≥2 char (`appendListParams`).
- **Sortable** (whitelist backend, kolom tabel kecuali Aksi): `fullName`, `email`, `status`, `requestType`, `createdAt`, `updatedAt`, `reviewedAt`, `subscription.name`.
- **Filter**: `filter[status]=PENDING|APPROVED|REJECTED` (Select di toolbar, default "Semua").
- Contoh query: `GET /api/v1/subscription-requests?page=1&limit=10&search=andi&sortBy=createdAt&sortOrder=desc&filter[status]=PENDING`.

## 5. Kolom & Aksi Tabel Admin

| Kolom | Sortable | Isi |
| --- | --- | --- |
| Requester | `fullName` | nama (font-medium) + organisasi (muted, opsional). |
| Email | `email` | email (muted). |
| Paket | `subscription.name` | nama paket. |
| Tipe | `requestType` | `requestTypeOptions.*` (New/Renewal). |
| Status | `status` | Badge: `PENDING`=`secondary`, `APPROVED`=`default`, `REJECTED`=`destructive`. |
| Created | `createdAt` | `formatDateTime` (`@/lib/datetime`). |
| Aksi | — | Lihat (selalu) + Setujui/Tolak (kondisional: `PENDING` + gate permission). |

- Tabel `overflow-x-auto`. Empty state bedakan "Belum ada permintaan" vs `Tidak ditemukan untuk "<search>"` + tombol Reset.
- Pagination pakai `DataTablePagination`.

## 6. Dialog & Form

- **Approve dialog** (`approve-subscription-request-dialog.tsx`): `Dialog` konfirmasi + seksi **unggah bukti pembayaran opsional** (drop zone `useFileDrop` + input file hidden, preview gambar/`FileText` + nama + `formatFileSize` + tombol hapus; validasi `isAcceptedProofFile` + `MAX_PROOF_BYTES` dari `@/lib/payment-proof`). Bukti diunggah lewat `POST /billings/payment-proof` (hook `useUploadPaymentProof` — route boleh lintas-fitur; komponen tetap presentational, unggah di-inject via props). Tombol confirm `disabled` saat submit/unggah. Dipakai di list, detail, dan dashboard (menghindari duplikasi).
- **Reject dialog** (`reject-subscription-request-dialog.tsx`): `AlertDialog` + `Textarea` catatan **opsional** (tanpa validasi wajib); tombol confirm `destructive`.
- **Request dialog** (`request-subscription-dialog.tsx`): RHF + zod (`useMemo(..., [t])`, pesan dari `t('validation:*')`). Pilih paket sebagai radiogroup kartu (`role="radiogroup"`/`role="radio"`/`aria-checked`, tombol native Enter/Space) berisi nama, tipe (badge), durasi, harga. Field `reason` (trim, wajib, max 2000) + kontak opsional (`phone`, `website` max 500, `address` max 500, `country`, `organisation`). 422 → `mapApiFieldErrors` per-field via `setError`; dialog tetap terbuka; tanpa toast. Non-422 → banner di atas form. Sukses → toast + tutup.
- Paket di dialog diambil di **container** (route) via `useAvailableSubscriptions({ page: 1, limit: 100, enabled: requestOpen })`, dipetakan ke `SubscriptionRequestPlanOption[]`. `defaultContact` didukung via props (route saat ini tidak mengirim — `SessionUser` belum punya phone/country).
- Semua mutation CUD memasang `toastSuccess`/`toastError` di call-site dengan pengecualian 422 (`isValidationError` early-return).

## 7. Self-Service `/my-billings`

- Panel `MySubscriptionRequestsPanel`: list request milik user (`useMySubscriptionRequests`, limit 100) + tombol "Ajukan Langganan" (tanpa gating permission — endpoint `POST|GET /subscription-requests/me` login-only). Status badge + catatan review (bila `REJECTED`).
- Dialog `RequestSubscriptionDialog` di-render dari container `my-billings.tsx`; submit via `useCreateMySubscriptionRequest`.

## 8. Dashboard

- Section `dashboard:pendingSubscriptionRequests` di `dashboard-home.tsx`, gate `subscription-request:read`; query `useSubscriptionRequests({ page, limit: 5, filter: { status: 'PENDING' }, enabled })`.
- Komponen `DashboardPendingSubscriptionRequests` (presentational): aksi **Lihat** (`/subscription-requests/:id`), **Setujui** (dialog konfirmasi + bukti opsional), **Tolak** (dialog + catatan) — gate `subscription-request:approve`/`reject`. Paginasi `DataTablePagination`.

## 9. i18n

- Namespace baru `subscriptionRequest` (en+id), terdaftar di `src/i18n/index.ts` (`resources` + `ns`).
- Key dashboard: `nav.subscriptionRequests`, `section.pendingSubscriptionRequests.*`, `pending.approve`/`pending.reject`.
- Key validasi `validation:reasonRequired`, `validation:reasonMax` ditambahkan (en+id).
- Reuse lintas namespace: `subscription:subscriptionTypeOptions.*`, `subscription:card.durationValue`, `common:actions.*`, `common:table.actions`.

## 10. Kamus Query Key & Invalidasi

| Hook | Query key |
| --- | --- |
| list admin | `['subscription-requests', { page, limit, search, sortBy, sortOrder, filter }]` |
| detail | `['subscription-request', { id }]` |
| list self-service | `['my-subscription-requests', { page, limit }]` |

- Approve/Reject → invalidate `['subscription-requests']`, `['subscription-request', { id }]`, `['billing']`, `['billing-members']`.
- Create (self-service) → invalidate `['my-subscription-requests']`.

## 11. Permissions

| Route / Aksi | Kode |
| --- | --- |
| Route `/subscription-requests` + detail | `subscription-request:read` |
| Approve | `subscription-request:approve` |
| Reject | `subscription-request:reject` |
| Menu sidebar "Subscription Requests" | `subscription-request:read` |
| Request self-service (`/my-billings`) | login-only, tanpa permission (`POST\|GET /subscription-requests/me`) |

## 12. Status & Catatan

- **Selesai**: list admin (search + sort semua kolom + filter status + skeleton + forbidden state), detail, dialog approve/reject, panel + dialog self-service `/my-billings`, section dashboard, sidebar, i18n en+id, dokumentasi.
- Kontrak API dianggap final per `backend/docs/modules/subscription-request.md`.
- Komponen `subscription-request-*` presentational; tanpa import antar-fitur (hanya `components/{shared,ui}`, `lib/`).
