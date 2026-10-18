# Module: Notification — Brief

Dokumen ini mencatat implementasi **notifikasi in-app** + **preferensi email** + tombol **kirim notifikasi saat publish/approve** pada frontend React. Mengikuti konvensi `frontend/AGENTS.md` dan format brief `docs/module/user.md`.

## 1. Tujuan & Ruang Lingkup

- Halaman `/notifications`: daftar notifikasi milik user login (paginated), tandai satu/semua dibaca, buka tautan konten.
- Kartu preferensi email di `/profile` (per tipe notifikasi, PATCH langsung saat toggle).
- Dukungan payload `notify` pada publish/approve Story, Event, Archive + dialog publish di dashboard.
- Detail Story/Event/Archive menerima **id atau slug** (route existing tidak berubah).

Di luar lingkup: badge unread di sidebar (menu biasa), halaman admin notifikasi, pengiriman email (backend).

## 2. Routing

| Route | Komponen | Akses |
| --- | --- | --- |
| `/notifications` | `src/app/routes/notifications.tsx` (`NotificationsPage`) | protected + login (permission `notification:read` di backend) |
| `/profile` | `src/app/routes/profile.tsx` | protected; kartu preferensi ditambahkan |

Nav: item `{ title: t('nav.notifications'), url: '/notifications', icon: Bell }` di `src/features/dashboard/components/app-shell.tsx`.

## 3. Struktur File

```
src/app/routes/notifications.tsx           # container: list + paginasi + mark read/all
src/app/routes/profile.tsx                 # wiring kartu preferensi + toast

src/features/notification/
├── types.ts                               # NotificationItem, NotificationType, NotificationEntityType, NotificationStatus, ListNotificationsParams, NotificationPreference
├── api/
│   └── notifications.ts                   # listNotifications, markNotificationRead, markAllNotificationsRead, getNotificationPreferences, updateNotificationPreference
├── hooks/
│   ├── use-notifications.ts               # query ['notification', params]
│   ├── use-mark-notification-read.ts      # mutation + invalidate ['notification']
│   ├── use-mark-all-notifications-read.ts # mutation + invalidate ['notification']
│   ├── use-notification-preferences.ts    # query ['notification', 'preferences']
│   └── use-update-notification-preference.ts # mutation + invalidate preferences
└── components/
    └── notification-preferences-card.tsx  # presentational: list switch, loading/error/retry
```

`Switch` ditambahkan via `pnpm dlx shadcn@latest add switch`.

## 4. Kontrak API

Base: `/api/v1`, JWT Bearer, envelope `{ data, message }` di-unwrap oleh `lib/api-client.ts`.

| Method | Path | Body / Query | Response |
| --- | --- | --- | --- |
| GET | `/notifications` | `?page&limit&status?&unread?` | `ListResult<NotificationItem>` |
| POST | `/notifications/:id/read` | — | `NotificationItem` |
| POST | `/notifications/read-all` | — | `{ updated: number }` |
| GET | `/notification-preferences` | — | `NotificationPreference[]` |
| PATCH | `/notification-preferences/:type` | `{ emailEnabled: boolean }` | `NotificationPreference` |

Enum:

- `NotificationType`: `CONTENT_PUBLISHED` | `CONTENT_SUBMITTED` | `SUBSCRIPTION_REQUEST_SUBMITTED`
- `NotificationEntityType`: `POST` | `EVENT` | `ARCHIVE`
- `NotificationStatus`: `PENDING` | `SENT` | `FAILED` | `SKIPPED`
- `NotificationPreference.channel`: `EMAIL`

## 5. Query Key & Cache

- List: `['notification', { page, limit, status?, unread? }]` — `placeholderData: keepPreviousData`, `staleTime: 15_000`.
- Preferensi: `['notification', 'preferences']` — `staleTime: 60_000`.
- Mutasi mark read/all dan update preferensi meng-invalidate prefix `['notification']`; toast dipasang di call-site.

## 6. Perilaku Halaman `/notifications`

- Limit 20; paginasi via `DataTablePagination`; clamp halaman saat total menyusut.
- Item unread: border `primary/40`, background `primary/5`, judul `font-semibold`, badge `Unread`; tanggal via `formatDateTime`.
- `linkPath`: path relatif → `<Link>`; `http(s)://` atau `//` → `<a target="_blank" rel="noopener noreferrer">`.
- Tombol **Mark as read** per item (disabled saat mutation item tsb berjalan); **Mark all as read** disabled bila tidak ada unread.
- State: skeleton 5 baris (loading), empty state (`empty`), 403 → `errors.forbidden`, error lain → `errors.loadData` + retry.
- Toast: `read` / `readFailed`, `allRead` / `allReadFailed`; error 422 early-return (tidak di-toast).

## 7. Preferensi di `/profile`

- `NotificationPreferencesCard` menerima `items/isLoading/isError/pendingType/onToggle/onRetry` (tanpa fetch sendiri).
- Toggle → `PATCH /notification-preferences/:type`; switch untuk tipe yang sedang PATCH di-disable.
- Toast `notification:toast.preferenceUpdated` / `preferenceUpdateFailed`; 422 early-return.

## 8. `notify` pada Publish/Approve

- `PublishScheduleDialog` mengirim `(publishedAt, notify)`; 6 call-site meneruskan nilai checkbox.
- `CreateStoryInput`/`CreateEventInput`/`CreateArchiveInput` + update input mendapat `notify?: boolean`; hanya jalur `approve`/`publish` yang mengirim `notify`, `save` tidak.
- `approve*` API mengirim `notify` hanya bila terdefinisi; body dihilangkan bila kosong (event/archive).
- Handler approve di `story-edit.tsx`, `event-edit.tsx`, `archive-edit.tsx`, dan dialog dashboard meneruskan `notify`; body PATCH approve/reject tidak memuat `notify`.
- Backend default `true` bila `notify` tidak dikirim (dipakai jalur approve langsung dari dashboard).

## 9. Slug pada Detail

- Endpoint: `GET /posts/slug/:slug`, `GET /events/slug/:slug`, `GET /archives/slug/:slug` (LOGIN + permission read).
- `useStory`/`useEvent`/`useArchive` mendeteksi UUID (`lib/uuid.ts:isUuid`) → `get*` by id, selain itu `get*BySlug`.
- `linkPath` notifikasi tetap id-based; hanya resolusi detail yang slug-aware.
- Query key mengikuti slug apa adanya (`['story', { id: param }]`).

## 10. i18n

- Namespace baru `notification` (`src/i18n/locales/{en,id}/notification.json`) didaftarkan di `src/i18n/index.ts`.
- Key utama: `title`, `subtitle`, `markAllRead`, `markRead`, `open`, `unread`, `read`, `empty`, `errors.forbidden`, `errors.loadData`, `toast.*`, `type.CONTENT_PUBLISHED`, `type.CONTENT_SUBMITTED`, `type.SUBSCRIPTION_REQUEST_SUBMITTED`, `preferences.*`.
- Nav: `dashboard:nav.notifications`.

## 11. Verifikasi

- `pnpm tsc --noEmit` — lulus.
- `pnpm lint` — 0 error, 9 warning (baseline pre-existing).

## 12. Catatan & Batasan

- Tidak ada badge jumlah unread di nav (di luar permintaan; tambah bila dibutuhkan — cukup query `unread=true&limit=1` dan pakai `total`).
- Filter status/unread tersedia di API & tipe, belum diekspos di UI.
- Halaman tidak melakukan polling; refresh manual lewat refetch/tab switch.
