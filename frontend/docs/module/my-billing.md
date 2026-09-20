# Module: My Billing — Brief

Halaman **self-service** untuk user yang sedang login: menampilkan langganan aktif miliknya + riwayat billing-nya. Bila belum punya langganan aktif, tampilkan katalog paket yang tersedia (display-only). Mengikuti `frontend/AGENTS.md` dan format brief `docs/module/billing.md`.

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
src/app/routes/my-billings.tsx                          # container (subscription + plans + billing list)

src/features/billing/
├── api/my-billings.ts                                  # listMyBillings → GET /billings/me
├── hooks/use-my-billings.ts                            # query ['my-billings', {...}]
└── components/my-billing-table.tsx                     # code, subscription, status, total, createdAt

src/features/subscription/
├── api/my-subscription.ts                              # getMySubscription, listAvailableSubscriptions
├── hooks/
│   ├── use-my-subscription.ts                          # query ['my-subscription']
│   └── use-available-subscriptions.ts                  # query ['available-subscriptions', {...}], enabled
└── components/
    ├── current-subscription-card.tsx                   # kartu langganan aktif
    └── available-plans-grid.tsx                        # grid katalog plan (display-only)
```

## 4. Kontrak API

| Endpoint | Keterangan |
| --- | --- |
| `GET /billings/me?page=&limit=&search=&sortBy=&sortOrder=` | List envelope `{ data: Billing[], meta }`, sudah scoped ke user. |
| `GET /subscriptions/me` | `{ data: Subscription \| null }` — langganan aktif user. |
| `GET /subscriptions/available?page=&limit=` | List envelope `{ data: Subscription[], meta }` — katalog plan. |

- Serialisasi query list via `lib/list-params.ts:appendListParams` (search <2 char diabaikan).
- **Searchable**: `code`, `currency`. Placeholder: "Cari kode atau mata uang...".
- **Sortable** (semua kolom tampil): `code`, `subscription.name`, `status`, `total`, `createdAt`.
- Contoh query: `GET /api/v1/billings/me?page=1&limit=10&search=INV&sortBy=total&sortOrder=desc`.

## 5. UI Behavior

- **Header**: title + subtitle (`myBilling:title/subtitle`).
- **Punya langganan** (`/subscriptions/me` non-null): `CurrentSubscriptionCard` (nama plan, `subscriptionType`, `currency`) + daftar billing paginated.
- **Tanpa langganan** (`data === null`): empty state langganan + `AvailablePlansGrid` (nama, type, currency). Katalog **display-only** — belum ada tombol Subscribe.
  - `ponytail:` di `available-plans-grid.tsx` mencatat plafon + jalur upgrade saat endpoint checkout tersedia.
- State: skeleton loading, error banner + tombol retry, forbidden state (`ShieldAlert`), empty state.
- Mobile-first, grid responsif, heading semantik (`h1`/`h2`, `aria-labelledby`).

## 6. Sidebar

- Item dashboard `nav.myBilling` di `app-shell.tsx` di-repoint dari `/billings` ke `/my-billings` dan **permission dihapus** → tampil untuk semua user.
- Entry admin `/billings` (grup Data Management, `billing:read`) tidak diubah.

## 7. i18n

- Namespace `myBilling` didaftarkan di `src/i18n/index.ts` (en + id), file `locales/{en,id}/myBilling.json`.
- Key utama: `title`, `subtitle`, `currentSubscription.*`, `noSubscription.*`, `availablePlans.*`, `billings.*`, `table.*`, `search.*`, `errors.*`.
- Reuse label enum lintas namespace: `subscription:subscriptionTypeOptions.*`, `billing:statusOptions.*`.

## 8. Permissions

| Route / Aksi | Kode |
| --- | --- |
| Route `/my-billings` | — (hanya butuh login) |
| Menu sidebar "My Billing" | — (semua user) |

## 9. Status & Catatan

- **Selesai**: subscription card, katalog plan saat tanpa langganan, billing list paginated + search + sort server-side, skeleton/error/forbidden/empty, i18n en+id, sidebar repoint.
- **Belum ada**: checkout/purchase/self-enroll — katalog murni display. Tambah aksi Subscribe saat endpoint tersedia.
