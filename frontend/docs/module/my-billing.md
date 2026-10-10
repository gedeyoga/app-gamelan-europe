# Module: My Billing — Brief

Halaman **self-service** untuk user yang sedang login: menampilkan status keanggotaan aktif, ringkasan pembayaran, callout tagihan menunggu bayar, + riwayat billing-nya. Bila belum punya langganan aktif, tampilkan katalog paket yang tersedia (display-only, kini dengan harga + durasi). Mengikuti `frontend/AGENTS.md` dan format brief `docs/module/billing.md`.

> Design read: authenticated account/billing page, calm information-dense dashboard, existing shadcn/ui + Geist + neutral oklch tokens, satu aksen status (primary) + varian amber untuk "expiring soon".

## 1. Tujuan & Ruang Lingkup

- Akses **semua user terautentikasi** (member tidak butuh permission `billing:read`).
- Data selalu di-scope backend ke user saat ini lewat endpoint `/me` — FE tidak mengirim `userId`.
- Katalog plan hanya di-fetch saat user **tidak** punya langganan aktif (`enabled` gating).
- **Tanpa flow pembelian/checkout** — tidak ada endpoint purchase/self-enroll.

## 2. Routing

- Route: `/my-billings`, nested di bawah `/` (`ProtectedRoute`), **tanpa** `RequirePermission`.
- Container page: `src/app/routes/my-billings.tsx` (`MyBillingsPage`).

```
/my-billings  → halaman self-service billing + langganan user
```

## 3. Struktur File

```
src/app/routes/my-billings.tsx                          # container (status panel + stats + callout + plans + billing list)

src/components/shared/
└── stat-card.tsx                                       # kartu stat reusable (ikon + label + nilai tabular-nums + hint)

src/features/billing/
├── api/my-billings.ts                                  # listMyBillings → GET /billings/me
├── hooks/use-my-billings.ts                            # query ['my-billings', {...}]
└── components/my-billing-table.tsx                     # code, plan, period, status, total(+discount/tax), paid, proof

src/features/subscription/
├── api/my-subscription.ts                              # getMySubscription, listAvailableSubscriptions
├── hooks/
│   ├── use-my-subscription.ts                          # query ['my-subscription']
│   └── use-available-subscriptions.ts                  # query ['available-subscriptions', {...}], enabled
└── components/
    ├── membership-status-panel.tsx                     # hero: paket aktif + harga + masa berlaku + meter sisa hari
    └── available-plans-grid.tsx                        # grid katalog plan (display-only: nama, harga, tipe, durasi)
```

## 4. Kontrak API

| Endpoint | Keterangan |
| --- | --- |
| `GET /billings/me?page=&limit=&search=&sortBy=&sortOrder=` | List envelope `{ data: Billing[], meta }`, sudah scoped ke user. |
| `GET /subscriptions/me` | `{ data: Subscription \| null }` — langganan aktif user. |
| `GET /subscriptions/available?page=&limit=` | List envelope `{ data: Subscription[], meta }` — katalog plan. |

- Serialisasi query list via `lib/list-params.ts:appendListParams` (search <2 char diabaikan).
- **Searchable**: `code`, `currency`. Placeholder: "Cari kode atau mata uang...".
- **Sortable** (tabel billing): `code`, `subscription.name`, `startDate` (kolom Periode), `status`, `total`, `paidAt`.
- Contoh query: `GET /api/v1/billings/me?page=1&limit=10&search=INV&sortBy=total&sortOrder=desc`.
- **Query ringkasan**: `useMyBillings({ page: 1, limit: 100 })` terpisah dari tabel (key `['my-billings', { page:1, limit:100 }]`) untuk menghitung statistik + callout lintas halaman. `ponytail:` batas 100 baris backend; pindah ke endpoint agregat bila terlampaui.

## 4a. Nilai turunan (dari data API, tanpa angka fiktif)

| Nilai | Sumber |
| --- | --- |
| `totalPaid` | Σ `total` billing `status = PAID` (query ringkasan). |
| `lastPaymentAt` | `max(paidAt)` billing PAID → `formatDate`. |
| `paymentCount` | `total` list billing (authoritative dari `meta.total`). |
| `pendingCount` / `pendingBilling` | Billing `status = PENDING` (terbaru, sort default `createdAt desc`). |
| Window masa berlaku | Billing PAID dengan `expiryDate` paling jauh → `startDate`/`expiryDate`. |
| `daysRemaining` | `ceil((expiryDate − now) / hari)`; `expiry < now` → expired, `≤ 14 hari` → expiring. |
| Meter progress | `(now − start) / (expiry − start)`; start hilang → diturunkan dari `expiry − durationInDays`. |

## 5. UI Behavior

- **Header**: `h1` title + subtitle + `MemberBadge` (saat `isMember`).
- **Panel status keanggotaan** (hero, grid asimetris `lg:grid-cols-[1.4fr_1fr]`):  - Kiri: nama paket aktif, badge tipe (`subscriptionType`), badge status, harga menonjol (gaya `subscription-card.tsx`), durasi.
  - Kanan: masa berlaku `startDate → expiryDate` (null-safe) + meter sisa hari. `expiring soon` → varian amber (ikon + teks, bukan warna saja); `expired` → state destructive + catatan.
  - Member tanpa subscription aktif → fallback card. Tanpa langganan **dan** bukan member → katalog plan menggantikan panel status di spot yang sama (heading + konten beralih; keduanya saling eksklusif).
- **Baris statistik** (`grid gap-4 sm:grid-cols-2 lg:grid-cols-4`) via `StatCard`: Total dibayar, Pembayaran terakhir, Jumlah pembayaran, Menunggu pembayaran.
- **Callout tagihan pending** (hanya bila ada PENDING): kode, total, status bukti bayar + link "Lihat bukti" bila `paymentProofUrl` ada. Tanpa checkout/self-enroll.
- **Katalog plan** (non-member): `AvailablePlansGrid` menampilkan nama, slug, harga+mata uang, tipe, durasi. Display-only.
- **Riwayat billing**: `SearchBar` + tabel sortable + `DataTablePagination`. Kolom: Code, Plan, Period (`startDate → expiryDate`), Status, Total (+hint discount/tax), Paid (`paidAt` / `—`), Proof (link bila ada).
- State: skeleton per blok (status panel, stat row, tabel), error banner + retry, forbidden (`ShieldAlert`), empty/notFound.
- Mobile-first, grid responsif (collapse eksplisit < `lg`/`md`), heading semantik (`h1`/`h2`, `aria-labelledby`).

## 6. Sidebar

- Item dashboard `nav.myBilling` di `app-shell.tsx` di-repoint dari `/billings` ke `/my-billings` dan **permission dihapus** → tampil untuk semua user.
- Entry admin `/billings` (grup Data Management, `billing:read`) tidak diubah.

## 7. i18n

- Namespace `myBilling` didaftarkan di `src/i18n/index.ts` (en + id), file `locales/{en,id}/myBilling.json` (kunci en + id simetris).
- Key utama: `title`, `subtitle`, `currentSubscription.title`, `statusPanel.*`, `stats.*`, `pendingCallout.*`, `membership.*`, `availablePlans.*`, `billings.*`, `table.*`, `search.*`, `errors.*`.
- Reuse label lintas namespace: `subscription:subscriptionTypeOptions.*`, `subscription:statusOptions.*`, `subscription:card.durationValue`, `billing:statusOptions.*`, `billing:history.viewProof`, `common:actions.retry`.

## 8. Permissions

| Route / Aksi | Kode |
| --- | --- |
| Route `/my-billings` | — (hanya butuh login) |
| Menu sidebar "My Billing" | — (semua user) |

## 9. Status & Catatan

- **Selesai**: panel status keanggotaan (hero asimetris + meter sisa hari + varian expiring/expired), baris statistik (total dibayar, pembayaran terakhir, jumlah pembayaran, menunggu pembayaran), callout tagihan pending, katalog plan saat tanpa langganan (harga + durasi), billing list paginated + search + sort server-side, skeleton per blok/error/forbidden/empty, i18n en+id, sidebar repoint.
- **Belum ada**: checkout/purchase/self-enroll — katalog murni display. Tambah aksi Subscribe saat endpoint tersedia.
