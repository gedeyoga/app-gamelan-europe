# Module: Billing — Brief

Dokumen ini mencatat desain/implementasi halaman **Billing Management** pada frontend React — **manajemen langganan member** (list paginated + aksi Upgrade/New/Cancel + dialog riwayat). Mengikuti konvensi `frontend/AGENTS.md` dan format brief `docs/module/user.md`.

> Catatan: CRUD billing lama (form `lines`, create/update/delete) **dihapus**. Halaman `/billings` kini fokus urusan langganan member. Halaman self-service `/my-billings` tidak berubah.

## 1. Tujuan & Ruang Lingkup

- Menyediakan **manajemen langganan member**: daftar member beserta status langganan (`ACTIVE`/`INACTIVE`/`NONE`), dengan aksi kondisional:
  - `ACTIVE` → **Upgrade**, **Cancel**, **History**.
  - `INACTIVE`/`NONE` → **New subscription**, **History**.
- Konsumsi API `/api/v1/billings/members`, `/billings/subscribe`, `/billings/:id/cancel`, `/billings?filter[userId]` (JWT Bearer + permission `billing:*`).
- Opsi paket untuk dialog diambil dari feature Subscription di **container** (route), bukan di komponen fitur: `useSubscriptions({page:1,limit:100})`, **lazy** — `enabled: subscribeTarget !== null && can('subscription:read')`.

## 2. Routing

- Route: `/billings`, nested di bawah `/` protected, dibungkus `<RequirePermission code="billing:read">`.
- Container page: `src/app/routes/billings.tsx` (`BillingsPage`).

```
/billings  → halaman manajemen langganan member
```

## 3. Struktur File

```
src/app/routes/billings.tsx                # container: state list/dialog + fetch opsi paket + hook riwayat

src/features/billing/
├── types.ts                               # Billing, MemberSubscription, MemberSubscriptionStatus, SubscribeInput, opsi, konstanta
├── api/
│   ├── members.ts                         # getMembers (GET /billings/members)
│   ├── subscribe.ts                       # subscribeBilling (POST /billings/subscribe)
│   ├── upload-payment-proof.ts            # uploadPaymentProof (POST /billings/payment-proof, multipart)
│   ├── cancel-billing.ts                  # cancelBilling (POST /billings/:id/cancel)
│   ├── user-billings.ts                   # listUserBillings (GET /billings?filter[userId])
│   └── my-billings.ts                     # listMyBillings (halaman self-service, tidak berubah)
├── hooks/
│   ├── use-billing-members.ts             # query ['billing-members', {...}]
│   ├── use-subscribe-billing.ts           # mutation + invalidate
│   ├── use-upload-payment-proof.ts        # mutation unggah bukti (tanpa invalidate)
│   ├── use-cancel-billing.ts              # mutation + invalidate
│   ├── use-user-billings.ts               # query ['user-billings', {...}] (enabled saat userId ada)
│   └── use-my-billings.ts                 # halaman self-service, tidak berubah
└── components/
    ├── billing-member-table.tsx           # avatar, user, paket, expiry, status, aksi kondisional
    ├── subscribe-billing-dialog.tsx       # RHF + zod, grid kartu paket + unggah bukti (New/Upgrade)
    ├── cancel-billing-dialog.tsx          # AlertDialog konfirmasi cancel
    ├── billing-history-dialog.tsx         # tabel riwayat + kolom bukti + pagination
    └── my-billing-table.tsx               # halaman self-service, tidak berubah
```

## 4. Kontrak API

| Endpoint | Body | Keterangan |
| --- | --- | --- |
| `GET /billings/members?page=&limit=&search=&sortBy=&sortOrder=` | — | list member + status langganan; envelope `{ data: MemberSubscription[], meta, message }`. |
| `POST /billings/subscribe` | `{ userId, subscriptionId, paymentProofUrl?, paymentProofName? }` | Buat langganan baru **atau** upgrade; billing aktif lama dibatalkan otomatis backend. Bukti opsional (dikirim hanya bila ada). |
| `POST /billings/payment-proof` | multipart field `file` | Unggah bukti pembayaran; terima `image/jpeg\|png\|webp` atau `application/pdf`, maks 10 MB. Response `{ url, filename, mimeType, size }`. |
| `POST /billings/:id/cancel` | — | Batalkan billing aktif (`:id` = `billingId`). |
| `GET /billings?filter[userId]=<id>&page=&limit=` | — | Riwayat billing milik user (endpoint list billing existing). |

```ts
MemberSubscription {
  userId: string
  user: { id: string; fullName: string; email: string; avatar: string | null }
  billingId: string | null
  startDate: string | null
  expiryDate: string | null
  subscription: { id: string; name: string; slug: string } | null
  status: 'ACTIVE' | 'INACTIVE' | 'NONE'
}
```

`Billing` (untuk riwayat) kini memuat `startDate: string | null`, `expiryDate: string | null`, `paymentProofUrl: string | null`, dan `paymentProofName: string | null`.

### Searchable / Sortable

- **Searchable** (backend): `user.fullName`, `user.email`. Placeholder: "Cari nama atau email...". Kirim hanya bila trim ≥2 char (`appendListParams`).
- **Sortable** (kolom tabel member, whitelist backend): `user.fullName`, `subscription.name`, `startDate`, `expiryDate`, `status`. Kolom avatar & aksi tidak sortable. Backend juga menerima `fullName`, `email`, `createdAt` (kolom lain).
- Contoh query: `GET /api/v1/billings/members?page=1&limit=10&search=andi&sortBy=expiryDate&sortOrder=asc`.

## 5. Kolom & Aksi Tabel

| Kolom | Sortable | Isi |
| --- | --- | --- |
| Foto profil | tidak | shadcn `Avatar`/`AvatarImage`/`AvatarFallback` (fallback inisial nama). |
| User | `user.fullName` | nama (font-medium) + email (muted). |
| Paket | `subscription.name` | nama paket atau `—` bila `null`. |
| Expiry date | `expiryDate` | `formatDate` dari `@/lib/datetime`; `—` bila null. |
| Status | `status` | Badge restrained: `ACTIVE`=`default`, `INACTIVE`=`secondary`, `NONE`=`outline`. |
| Aksi | — | tombol kondisional (lihat bawah). |

- Aksi + gate permission: **Upgrade**/**New subscription** (`billing:create`), **Cancel** (`billing:update`), **History** (`billing:read`).
- Tabel `overflow-x-auto` (mobile bisa scroll horizontal). `tabular-nums` untuk tanggal.
- Empty state bedakan "Belum ada member" vs `Tidak ditemukan untuk "<search>"` + tombol Reset.

## 6. Dialog

- **Subscribe/Upgrade dialog** (`subscribe-billing-dialog.tsx`): RHF + zod (field `subscriptionId`, wajib dipilih). Paket ditampilkan sebagai **grid kartu** (`role="radiogroup"` + `role="radio"`/`aria-checked`, tombol native — Enter/Space; kartu terpilih `ring-2 ring-primary`) berisi nama, tipe (badge), durasi, dan harga+currency (`tabular-nums`). Plus **unggah bukti pembayaran opsional**: drag-drop + tombol pilih file (`useFileDrop`), terima `image/jpeg\|png\|webp`/`application/pdf`, maks 10 MB; validasi tipe & ukuran di client sebelum unggah; unggah langsung saat file dipilih (`useUploadPaymentProof`), preview gambar (`<img>`) atau ikon `FileText` + nama + `formatFileSize`, tombol hapus. Tombol Simpan disabled saat unggah berjalan. Sukses/gagal non-422 → toast call-site; 422 → `mapApiFieldErrors` per-field, dialog tetap terbuka, tanpa toast.
- **Cancel dialog** (`cancel-billing-dialog.tsx`): `AlertDialog` konfirmasi; tombol confirm `destructive`.
- **History dialog** (`billing-history-dialog.tsx`): daftar billing user via `useUserBillings`; kolom code, paket, status, **bukti pembayaran** (link "Lihat bukti" ke `paymentProofUrl` di tab baru + nama file, `—` bila kosong), total+currency, paidAt, canceledAt, expiryDate, created; pagination `DataTablePagination`. Data + state pagination di container (komponen presentational).

## 7. Permissions

| Route / Aksi | Kode |
| --- | --- |
| Route `/billings` | `billing:read` |
| Upgrade / New subscription | `billing:create` |
| Cancel | `billing:update` |
| History | `billing:read` |
| Opsi paket (`useSubscriptions` lazy) | `subscription:read` |
| Menu sidebar "Billing Management" | `billing:read` |

## 8. Status & Catatan

- **Selesai**: list member + search/sort server-side + skeleton + forbidden state + permission gating per aksi + dialog subscribe/upgrade (RHF+zod) + dialog cancel + dialog riwayat berpaginasi.
- **Dihapus**: `billing-table.tsx`, `billing-form-dialog.tsx`, `delete-billing-dialog.tsx`, `api/billings.ts`, `use-billings.ts`, `use-create-billing.ts`, `use-update-billing.ts`, `use-delete-billing.ts`, beserta type/konstanta CRUD lama (`CreateBillingInput`, `UpdateBillingInput`, `BILLING_*`).
- **Dikecualikan**: `my-billings.tsx`, `my-billing-table.tsx`, `use-my-billings.ts`, `api/my-billings.ts`, serta key `billing:statusOptions.*` (dipakai tabel self-service).
- Kontrak endpoint member/subscribe/cancel dianggap final (BE dibuat paralel).
