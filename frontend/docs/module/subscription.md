# Module: Subscription — Brief

Dokumen ini mencatat desain/implementasi halaman **Subscriptions** pada frontend React — CRUD lengkap paket langganan. Mengikuti konvensi `frontend/AGENTS.md` dan format brief `docs/module/user.md`.

## 1. Tujuan & Ruang Lingkup

- Menyediakan **CRUD subscription**: lihat daftar (pagination), tambah, edit, hapus (soft delete).
- Konsumsi API `/api/v1/subscriptions` (backend **sudah ada** — lihat `backend/docs/modules/subscription.md`), butuh JWT Bearer + permission `subscription:*`.
- Halaman related `my-billings.tsx` (`/my-billings`) memakai komponen fitur ini untuk menampilkan langganan aktif user + paket tersedia.

## 2. Routing

- Route: `/subscriptions`, nested di bawah `/` protected, dibungkus `<RequirePermission code="subscription:read">`.
- Container page: `src/app/routes/subscriptions.tsx` (`SubscriptionsPage`).

```
/subscriptions  → halaman CRUD Subscriptions
```

## 3. Struktur File

```
src/app/routes/subscriptions.tsx          # container

src/features/subscription/
├── types.ts                              # SubscriptionType, SubscriptionStatus, SUBSCRIPTION_CURRENCIES/STATUSES, Subscription, Create/UpdateSubscriptionInput
├── lib/
│   ├── duration.ts                       # toDurationInDays / fromDurationInDays (30 hari/bulan, 365 hari/tahun)
│   ├── price.ts                          # formatPriceInput / parsePriceInput (format `en`)
│   └── slug.ts                           # slugify(name) — slug otomatis dari nama
├── api/subscriptions.ts                  # listSubscriptions, create/update/delete
├── hooks/
│   ├── use-subscriptions.ts              # query ['subscriptions', {...}]
│   ├── use-create-subscription.ts
│   ├── use-update-subscription.ts
│   └── use-delete-subscription.ts
└── components/
    ├── subscription-card.tsx             # kartu tunggal (presentational)
    ├── subscription-card-grid.tsx         # grid + empty state
    ├── subscription-sort-control.tsx      # Select sort (pengganti SortableHeader)
    ├── subscription-form-dialog.tsx
    ├── delete-subscription-dialog.tsx
    ├── membership-status-panel.tsx          # panel status keanggotaan aktif user (my-billings.tsx)
    └── available-plans-grid.tsx           # grid paket tersedia (my-billings.tsx)
```

## 4. Kontrak API

| Endpoint | Body | Keterangan |
| --- | --- | --- |
| `POST /subscriptions` | `{ name, slug, subscriptionType, status, currency, price, durationInDays }` | `name` wajib max200; `slug` wajib kebab-case `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`; `subscriptionType` `MONTHLY`\|`YEARLY`; `status` `ACTIVE`\|`INACTIVE` (default `ACTIVE`); `currency` max10; `price` Decimal(12,2) ≥ 0 (maks 2 desimal); `durationInDays` integer ≥ 1. |
| `GET /subscriptions?page=&limit=` | — | list paginated. |
| `GET /subscriptions?search=&sortBy=&sortOrder=` | — | search OR like `name,slug,currency`; <2 char diabaikan. |
| `PATCH /subscriptions/:id` | field opsional | update. |
| `DELETE /subscriptions/:id` | — | **soft delete**. |

SubscriptionEntity: `{ id, name, slug, subscriptionType, status, currency, price, durationInDays, subscriberCount, createdAt, updatedAt }`. `status` = `ACTIVE`\|`INACTIVE` (default `ACTIVE`). `subscriberCount` = jumlah user unik dengan billing PAID pada paket ini (number, dihitung BE).

### Form Input → Payload

Field form (urutan render): `name`, `subscriptionType`, `durationAmount`, `currency`, `price`, `status`.

- **Slug** — tidak ditampilkan di form; dihitung otomatis dari `name` saat submit via `slugify` (`lib/slug.ts`: lowercase, buang diakritik, run non `[a-z0-9]` → `-`, potong tepi, ≤200 char). Deterministik/idempotent: nama sama → slug sama. Hasil wajib lolos `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`; nama kosong ditahan validasi zod `name`.

- **Durasi** — FE yang mengonversi jumlah ke hari (backend tidak berubah, tetap terima `durationInDays`):
  - `MONTHLY`: `durationInDays = durationAmount × 30`
  - `YEARLY`: `durationInDays = durationAmount × 365`
  - Label dinamis: `Jumlah Bulan` (MONTHLY) / `Jumlah Tahun` (YEARLY). Mode edit mengisi `durationAmount` reverse via `fromDurationInDays` (`Math.round`, dibulatkan karena hari tak selalu kelipatan pas).
- **Harga** — input tampil terformat `en` (pemisah ribuan koma, desimal titik, maks 2 desimal, mis. `1,000,000.50`), disimpan sebagai string lalu di-parse ke number saat submit. `inputMode="decimal"`.
- **Currency** — `Select` opsi tetap `SUBSCRIPTION_CURRENCIES = ['IDR','USD','EUR','SGD','MYR']`; label opsi = kode. Digabung satu baris dengan input harga.
- **Status** — `RadioGroup` shadcn (`FormField` + `FormItem` + `FormControl` + `FormMessage`), satu `RadioGroupItem` + label per nilai `SUBSCRIPTION_STATUSES = ['ACTIVE','INACTIVE']` (`subscription:statusOptions.*`), layout horizontal (`flex flex-wrap gap-4`). Default create `ACTIVE`; mode edit pakai `subscription.status`. Selalu ikut payload create/update.
- Zod memvalidasi hasil parse harga: `≥ 0`, maks 2 desimal.

Contoh payload create:

```json
{
  "name": "Pro Bulanan",
  "slug": "pro-bulanan",
  "subscriptionType": "MONTHLY",
  "status": "ACTIVE",
  "currency": "IDR",
  "price": 1000000.5,
  "durationInDays": 90
}
```

### Searchable / Sortable

- **Searchable**: `name`, `slug`, `currency`. Placeholder: "Cari nama, slug, atau mata uang...".
- **Sortable** (semua kolom tampil): `name`, `slug`, `subscriptionType`, `status`, `currency`, `price`, `durationInDays`, `createdAt` (+ `updatedAt`).
- Contoh query: `GET /api/v1/subscriptions?page=1&limit=10&search=pro&sortBy=price&sortOrder=asc`.

### Tampilan Card (bukan tabel)

List subscription ditampilkan sebagai **grid kartu** menggantikan tabel (deviasi dari pola tabel `AGENTS.md`). Alasan: entitas kecil (8 field) & beberapa angka menonjol (harga, durasi) lebih mudah dibaca per-kartu; menyejajarkan dengan tampilan list lain di app (story/event/archive).

- **Grid** (`subscription-card-grid.tsx`): pakai `CARD_GRID_CLASS` dari `@/components/shared/card-grid` (`grid gap-4 grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]`); empty state bedakan "belum ada" vs `Tidak ditemukan untuk "<term>"` + tombol Reset (`Button variant="link"`, pola sama dengan tabel). Kartu tak dirender bila kosong. Skeleton (`subscriptions.tsx`) memakai `CARD_GRID_CLASS` yang sama + bentuk kartu (header, harga, meta, footer aksi) agar bebas layout shift; footer skeleton meniru kartu nyata (`mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2`, dua blok skeleton full-width, **tanpa** `border-t`).
- **Kartu** (`subscription-card.tsx`): nama (`truncate`) + satu baris badge: `Badge` tipe (`variant="secondary"`) + `Badge` status (`subscription:statusOptions.*`; `ACTIVE` = `variant="secondary"`, `INACTIVE` = `variant="outline"`, restrained bukan destructive, label dari `t()`); harga ditonjolkan (`tabular-nums`, teks besar) + meta kecil: durasi (`subscription:card.durationValue`), `subscriberCount` (`subscription:fields.subscriberCount` + `subscription:card.subscriberValue`), dibuat (`formatDateTime`). Slug **tidak** ditampilkan di kartu. Footer aksi di bawah kartu dengan pola tombol sama seperti **story-card** (`mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2`, tanpa `border-t`): **Edit** (`Button variant="outline"`, ikon `Pencil`), **Hapus** (`Button variant="destructive"`, ikon `Trash2`), keduanya full-width dalam grid; gate `subscription:update`/`subscription:delete`. `DropdownMenu` aksi di header tidak dipakai lagi. Ikon leading dari `lucide-react`; token warna/radius via design system; animasi hormati `motion-reduce`.
- **Sort control** (`subscription-sort-control.tsx`): karena kartu tak punya header kolom, `SortableHeader` tidak dipakai. Satu `Select` berisi semua field dari `SUBSCRIPTION_SORTABLE_FIELDS` dikombinasikan arah, `value="<field>:<asc|desc>"`, plus opsi `default` (= tanpa sort → `createdAt desc`). Label opsi = i18n label kolom (`subscription:fields.*`) + arah (`common:sort.asc|desc`). `sort` berubah → `setPage(1)`. `SortableHeader` tetap dipakai modul tabel lain.
- **Baris kontrol**: `SearchBar` kiri + sort control kanan (satu baris `flex flex-wrap`).
- **Kolom/field label** dipusatkan di `subscription:fields.*` (dipakai kartu + label opsi sort). Skeleton menyerupai bentuk kartu (grid, bukan baris tabel).

## 5. Konvensi & Permissions

- Query key `['subscriptions', { page, limit, search, sortBy, sortOrder }]`, `keepPreviousData`, `staleTime: 30_000`; search debounce 400ms; clamp halaman.
- Form RHF + zod; urutan field: `name`, `subscriptionType`, `durationAmount` (label dinamis), `currency` (`Select` kode), `price` (input terformat `en` satu baris dengan currency), lalu `status` (`RadioGroup`). `slug` otomatis dari `name` saat submit. `subscriptionType` label dari `subscription:subscriptionTypeOptions.*`.
- 422 → per-field; toast call-site `subscription:toast.*`.
- Gate: route `subscription:read`; tombol `subscription:create`; edit `subscription:update`; hapus `subscription:delete`; menu sidebar `subscription:read`.

## 6. Status & Catatan

- **Selesai**: CRUD + pagination + search + sort server-side + skeleton + forbidden state + permission gating.
- **Tampilan**: grid kartu (bukan tabel) — lihat "Tampilan Card" di atas; sort via `Select` (`subscription-sort-control.tsx`), bukan `SortableHeader`.
- **Kontrak backend**: endpoint `/subscriptions` **sudah diimplementasikan** — lihat `backend/docs/modules/subscription.md` (soft-delete via `deletedAt`, permission `subscription:*`, `subscriptionType` enum `MONTHLY|YEARLY`, `currency` string bebas max10, `price` Decimal(12,2), `durationInDays` integer ≥ 1).
