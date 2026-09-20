# Module: Subscription — Brief

Dokumen ini mencatat desain/implementasi halaman **Subscriptions** pada frontend React — CRUD lengkap paket langganan. Mengikuti konvensi `frontend/AGENTS.md` dan format brief `docs/module/user.md`.

## 1. Tujuan & Ruang Lingkup

- Menyediakan **CRUD subscription**: lihat daftar (pagination), tambah, edit, hapus (soft delete).
- Konsumsi API `/api/v1/subscriptions` (kontrak BE dibuat paralel), butuh JWT Bearer + permission `subscription:*`.

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
├── types.ts                              # SubscriptionType, Subscription, Create/UpdateSubscriptionInput
├── api/subscriptions.ts                  # listSubscriptions, create/update/delete
├── hooks/
│   ├── use-subscriptions.ts              # query ['subscriptions', {...}]
│   ├── use-create-subscription.ts
│   ├── use-update-subscription.ts
│   └── use-delete-subscription.ts
└── components/
    ├── subscription-table.tsx
    ├── subscription-form-dialog.tsx
    └── delete-subscription-dialog.tsx
```

## 4. Kontrak API

| Endpoint | Body | Keterangan |
| --- | --- | --- |
| `POST /subscriptions` | `{ name, slug, subscriptionType, currency }` | `name` wajib max200; `slug` wajib kebab-case `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`; `subscriptionType` `MONTHLY`\|`YEARLY`; `currency` max10. |
| `GET /subscriptions?page=&limit=` | — | list paginated. |
| `GET /subscriptions?search=&sortBy=&sortOrder=` | — | search OR like `name,slug,currency`; <2 char diabaikan. |
| `PATCH /subscriptions/:id` | field opsional | update. |
| `DELETE /subscriptions/:id` | — | **soft delete**. |

SubscriptionEntity: `{ id, name, slug, subscriptionType, currency, createdAt, updatedAt }`.

### Searchable / Sortable

- **Searchable**: `name`, `slug`, `currency`. Placeholder: "Cari nama, slug, atau mata uang...".
- **Sortable** (semua kolom tampil): `name`, `slug`, `subscriptionType`, `currency`, `createdAt` (+ `updatedAt`).
- Contoh query: `GET /api/v1/subscriptions?page=1&limit=10&search=pro&sortBy=name&sortOrder=asc`.

## 5. Konvensi & Permissions

- Query key `['subscriptions', { page, limit, search, sortBy, sortOrder }]`, `keepPreviousData`, `staleTime: 30_000`; search debounce 400ms; clamp halaman.
- Form RHF + zod; `subscriptionType` via `Select` (MONTHLY/YEARLY), label dari `subscription:subscriptionTypeOptions.*`.
- 422 → per-field; toast call-site `subscription:toast.*`.
- Gate: route `subscription:read`; tombol `subscription:create`; edit `subscription:update`; hapus `subscription:delete`; menu sidebar `subscription:read`.

## 6. Status & Catatan

- **Selesai**: CRUD + pagination + search + sort server-side + skeleton + forbidden state + permission gating.
- **Asumsi kontrak**: endpoint `/subscriptions` dan error code belum ada di `backend/docs/modules/` saat implementasi — perlu konfirmasi `subscriptionType` enum, `currency` (kode ISO vs bebas), dan soft-delete response.
