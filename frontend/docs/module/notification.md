# Module: Notification — Brief

Dokumen ini mencatat **preferensi notifikasi email** + tombol **kirim notifikasi saat publish/approve** pada frontend React. Mengikuti konvensi `frontend/AGENTS.md` dan format brief `docs/module/user.md`.

> **Perubahan (2026-10): daftar notifikasi in-app dihapus.** User menerima notifikasi lewat **email**, sehingga halaman `/notifications`, menu sidebar, route, hooks list/mark-read, dan endpoint list tidak lagi dipakai di frontend. Yang tersisa hanya **preferensi email** di `/profile`.

## 1. Tujuan & Ruang Lingkup

- Kartu preferensi email di `/profile` (per tipe notifikasi, PATCH langsung saat toggle).
- Dukungan payload `notify` pada publish/approve Story, Event, Archive + dialog publish di dashboard.
- Detail Story/Event/Archive menerima **id atau slug** (route existing tidak berubah).

Di luar lingkup: halaman/list notifikasi in-app (dihapus), pengiriman email (backend).

## 2. Routing

| Route | Komponen | Akses |
| --- | --- | --- |
| `/profile` | `src/app/routes/profile.tsx` | protected; kartu preferensi ditambahkan |

Tidak ada route `/notifications` dan tidak ada item nav notifikasi di `src/features/dashboard/components/app-shell.tsx`.

## 3. Struktur File

```
src/app/routes/profile.tsx                 # wiring kartu preferensi + toast

src/features/notification/
├── types.ts                               # NotificationType, NotificationPreference
├── api/
│   └── notifications.ts                   # getNotificationPreferences, updateNotificationPreference
├── hooks/
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
| GET | `/notification-preferences` | — | `NotificationPreference[]` |
| PATCH | `/notification-preferences/:type` | `{ emailEnabled: boolean }` | `NotificationPreference` |

Enum:

- `NotificationType`: `CONTENT_PUBLISHED` | `CONTENT_SUBMITTED` | `SUBSCRIPTION_REQUEST_SUBMITTED` | `SUBSCRIPTION_ACTIVE` | `SUBSCRIPTION_EXPIRING` | `SUBSCRIPTION_EXPIRED` | `SUBSCRIPTION_CANCELED`
- `NotificationPreference.channel`: `EMAIL`

## 5. Query Key & Cache

- Preferensi: `['notification', 'preferences']` — `staleTime: 60_000`.
- Mutasi update preferensi meng-invalidate prefix `['notification']`; toast dipasang di call-site.
- Dihapus bersama halaman: query `['notification', params]` serta invalidasi mark read/all.

## 6. Perilaku Preferensi di `/profile`

- `NotificationPreferencesCard` menerima `items/isLoading/isError/pendingType/onToggle/onRetry` (tanpa fetch sendiri).
- Toggle → `PATCH /notification-preferences/:type`; switch untuk tipe yang sedang PATCH di-disable.
- Toast `notification:toast.preferenceUpdated` / `preferenceUpdateFailed`; 422 early-return.

## 7. `notify` pada Publish/Approve

- `PublishScheduleDialog` mengirim `(publishedAt, notify)`; 6 call-site meneruskan nilai checkbox.
- `CreateStoryInput`/`CreateEventInput`/`CreateArchiveInput` + update input mendapat `notify?: boolean`; hanya jalur `approve`/`publish` yang mengirim `notify`, `save` tidak.
- `approve*` API mengirim `notify` hanya bila terdefinisi; body dihilangkan bila kosong (event/archive).
- Handler approve di `story-edit.tsx`, `event-edit.tsx`, `archive-edit.tsx`, dan dialog dashboard meneruskan `notify`; body PATCH approve/reject tidak memuat `notify`.
- Backend default `true` bila `notify` tidak dikirim (dipakai jalur approve langsung dari dashboard).

## 8. Slug pada Detail

- Endpoint: `GET /posts/slug/:slug`, `GET /events/slug/:slug`, `GET /archives/slug/:slug` (LOGIN + permission read).
- `useStory`/`useEvent`/`useArchive` mendeteksi UUID (`lib/uuid.ts:isUuid`) → `get*` by id, selain itu `get*BySlug`.
- Query key mengikuti slug apa adanya (`['story', { id: param }]`).

## 9. i18n

- Namespace `notification` (`src/i18n/locales/{en,id}/notification.json`) didaftarkan di `src/i18n/index.ts`.
- Key tersisa: `toast.preferenceUpdated`, `toast.preferenceUpdateFailed`, `type.CONTENT_PUBLISHED`, `type.CONTENT_SUBMITTED`, `type.SUBSCRIPTION_REQUEST_SUBMITTED`, `type.SUBSCRIPTION_ACTIVE`, `type.SUBSCRIPTION_EXPIRING`, `type.SUBSCRIPTION_EXPIRED`, `type.SUBSCRIPTION_CANCELED`, `preferences.*`.
- Key list-page (`title`, `subtitle`, `markAllRead`, `markRead`, `open`, `unread`, `read`, `empty`, `errors`, `toast.read*`, `toast.allRead*`) dan `dashboard:nav.notifications` dihapus.

## 10. Verifikasi

- `pnpm exec tsc -p tsconfig.app.json --noEmit` — lulus.
- `pnpm lint` — 0 error.
- `pnpm build` — lulus; `dist/` di-refresh.

## 11. Catatan & Batasan

- Tidak ada indikator unread di UI (tidak relevan lagi tanpa daftar in-app).
- Preferensi hanya mengatur channel email; pengiriman email sepenuhnya di backend.
