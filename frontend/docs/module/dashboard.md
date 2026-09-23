# Module: Dashboard — Brief

Dokumen ini mencatat rencana desain/implementasi halaman **Dashboard** pada frontend React, menampilkan post-login, mengikuti contoh dashboard shadcn/ui (<https://ui.shadcn.com/examples/dashboard>). Mengikuti konvensi `AGENTS.md` frontend.

## 1. Tujuan & Ruang Lingkup

- Menyediakan **shell aplikasi** pasca-login: sidebar + header + area konten.
- **Iterasi-1**: navigasi, identitas user, tema light/dark, dan logout. Konten halaman **kosongan** (placeholder title) — tanpa endpoint/statistik backend.
- Data statistik (kartu angka, chart, dsb.) = **iterasi berikutnya** (TODO).

## 2. Routing

- Route di `src/app/routes/` (React Router, `createBrowserRouter`).
- `/` (**protected**) — tanpa token → redirect ke `/login` (wrap `ProtectedRoute` dari `@/features/auth/auth-routes`). Setelah login, `useLogin` → `navigate('/')`.
- Dashboard menempati root `/`; halaman `/login` & `/register` public (GuestRoute).

Struktur nested:

```
/  (parent → AppShell)
├── /        index  → halaman Dashboard (title + placeholder)
├── /users          → halaman User (CRUD)
└── /roles          → halaman Roles (CRUD)
```

## 3. Layout (AppShell)

- `SidebarProvider` (dari `components/ui/sidebar`) → `AppSidebar` di kiri + area main.
- Area main: baris header (SidebarTrigger, breadcrumb, theme toggle) lalu `<Outlet/>` (halaman anak).
- **Pengecualian — sidebar hidden**: pada route editor story (`/stories/new` & `/stories/:id/edit`) `AppShell` mendeteksi `isStoryEditor` (match `pathname`, setelah normalisasi trailing slash kecuali root) dan merender layout khusus **tanpa** sidebar (`SidebarProvider`/`AppSidebar`/`SidebarInset`/`SidebarTrigger` ditiadakan) — hanya header sticky `h-14` berisi breadcrumb (Dashboard / Story / judul) + `LanguageSwitcher` + `ThemeToggle`, lalu `<main>` dengan `<Outlet/>`. Breadcrumb adalah **sumber judul halaman** (halaman editor tidak merender `<h1>` ganda). Route lain (termasuk list `/stories`) tetap memakai sidebar.

## 4. Sidebar (AppSidebar)

- **SidebarHeader**: brand "European Gamelan Society".
- **SidebarContent** (navigasi):
  - Grup atas (tanpa label): **Dashboard** (`Home`, `/`), **Story** (`Newspaper`, permission `admin:access` — menu admin-only), **Event** (`CalendarDays`, permission `event:read`), **My Billing** (`Receipt`, `/billings`, permission `billing:read`).
  - Group **Data Management** (`t('group.dataManagement')`):
    - **User** → `/users` (ikon `Users`, permission `user:read`).
    - **Role** → `/roles` (ikon `Shield`, permission `role:read`).
    - **Organizations** → `/organizations` (ikon `Building2`, permission `organization:read`).
  - Group **Payment** (`t('group.payment')`, dirender setelah Data Management):
    - **Subscription** → `/subscriptions` (ikon `CreditCard`, permission `subscription:read`).
    - **Billing** (`t('nav.billing')`) → `/billings` (ikon `Receipt`, permission `billing:read`).
  - **Catatan**: Billing tampil **dobel** (My Billing di grup atas + Billing di grup Payment), keduanya menuju `/billings` — disengaja. Karena `isActive` = `pathname === url`, kedua item aktif bersamaan.
- **SidebarFooter**: `SidebarUser` — avatar + `fullName` + `email` (data dari `useAuth().user`); dropdown menu berisi entri **Pengaturan** (placeholder) dan **Keluar** (logout).
- Pada layar mobile sidebar ter-show sebagai sheet (perilaku bawaan komponen `sidebar`).

## 5. Header

- `SidebarTrigger` (toggle sidebar, terutama mobile).
- `Breadcrumb` dinamis mengikuti route aktif (Dashboard / User / Roles).
- Kanan: `ThemeToggle` (tombol Sun/Moon).

## 6. Tema Light/Dark

- Class `dark` di `<html>` dikendalikan via hook `useTheme` (di `features/dashboard/hooks/use-theme.ts`); init: baca `localStorage['theme']`, fallback `prefers-color-scheme`.
- Anti-flash: inline script kecil di `index.html` yang set class `dark` sebelum React render.
- Toggle menambah/menghapus class `dark` (token dark sudah didefinisikan — lihat `docs/DESIGN_SYSTEM.md` §6). Ikon `Sun`/`Moon` (lucide-react).
- **Tanpa dependency baru** (tanpa next-themes/dll).

## 7. Logout

- Tombol di dropdown `SidebarUser`.
- `logout()` dari `@/features/auth/auth-provider` + `navigate('/login', { replace: true })` — pola sama dengan `src/app/routes/home.tsx`.

## 8. Komponen yang Ditambah (via CLI saja)

Larang edit manual `src/components/ui/` (AGENTS.md & DESIGN_SYSTEM.md):

```
pnpm dlx shadcn@latest add sidebar dropdown-menu avatar breadcrumb separator skeleton tooltip
```

`button`, `input`, `card` sudah tersedia; `sidebar` menginstal deps pendukungnya sendiri.

## 9. Struktur File

```
src/app/routes/
├── dashboard.tsx        # parent/shell (ProtectedRoute)
├── dashboard-home.tsx   # halaman Dashboard (title + area kosong)
├── users.tsx            # halaman User (title only)
└── roles.tsx            # halaman Roles (title only)

src/features/dashboard/
├── components/
│   ├── app-shell.tsx    # SidebarProvider + AppSidebar + header + <Outlet/>
│   ├── app-sidebar.tsx  # navigasi + brand + SidebarUser
│   ├── sidebar-user.tsx # avatar + info user + dropdown (Pengaturan/Keluar)
│   └── theme-toggle.tsx # tombol Sun/Moon
└── hooks/
    └── use-theme.ts     # state + persist tema (localStorage['theme'])
```

## 10. Konvensi (AGENTS.md)

- Komponen **presentational**: data via props, logika data/hook via container; tanpa fetch di komponen.
- Nav items dikonfigurasi sebagai data (prop), bukan hardcode di tiap komponen.
- `cn()` dari `@/lib/utils` untuk className + override.
- Tanpa import lintas domain (`src/features/dashboard/` hanya boleh impor `components/ui`, `components/shared`, `lib`).

## 10a. Konten Dashboard (member/org)

Dashboard home (`/`, `src/app/routes/dashboard-home.tsx`) diisi konten untuk user **member** & **organization**: hero, kartu statistik, event akan datang, dan story terbaru.

### Routing & data source

- Route: `index` `/` (protected) → `DashboardHomePage`.
- `const { user } = useAuth()`; `roleName = user?.role?.name ?? ''` untuk badge role.
- Page **boleh** import hook lintas domain; `features/dashboard/` tetap tanpa import event/story — data dipetakan ke view type lokal `features/dashboard/types.ts` lalu dipass sebagai props.

| Data | Query (query key domain) | Endpoint |
| --- | --- | --- |
| Event akan datang | `useEvents({ page: 1, limit: 100, filter: { status: 'PUBLISHED' }, upcoming: true, sortBy: 'publishedAt', sortOrder: 'desc' })` | `GET /events?page=1&limit=100&filter[status]=PUBLISHED&upcoming=true&sortBy=publishedAt&sortOrder=desc` |
| Story terbaru | `useStories({ page: 1, limit: 6, filter: { status: 'PUBLISHED' }, sortBy: 'publishedAt', sortOrder: 'desc' })` | `GET /posts?page=1&limit=6&filter[status]=PUBLISHED&sortBy=publishedAt&sortOrder=desc` |

- Serialisasi `filter` = `search.set(\`filter[${key}]\`, value)` (parser Express `extended`). `upcoming=true` → `search.set('upcoming','true')`.
- Mapping event: pilih tanggal **terdekat ≥ sekarang** (`new Date(iso).getTime()`), buang event tanpa tanggal mendatang, urut naik (tanpa `slice(0,6)` — pagination klien, §10g). Mapping story: `categories[].name`, `creator.fullName`, `publishedAt`.
- Kartu statistik: `eventsQuery.data.total` (Event Akan Datang) + `storiesQuery.data.total` (Story Terbit). Tanpa kartu ketiga (data tidak tersedia → tidak mengarang).
- Loading → skeleton; error/empty → empty-state muted (tanpa teks error mentah).

### Komponen Baru (`src/features/dashboard/components/`)

- `dashboard-hero.tsx` — banner gradient (`from-primary/10 via-primary/5 to-transparent`), greeting `welcome` + badge role.
- `dashboard-stat-card.tsx` — `icon: LucideIcon` + label + value besar + `hint?`.
- `dashboard-section.tsx` — wrapper section (title/subtitle/`empty`/children). Props opsional `viewAllTo`+`viewAllLabel` **tetap ada** di komponen, tetapi **tidak lagi dipakai** oleh `dashboard-home.tsx` (§10g).
- `dashboard-story-card.tsx` — thumbnail, judul, badge kategori, author, tanggal; link `/stories/{id}`.
- `dashboard-skeletons.tsx` — `DashboardCardSkeleton`.

### i18n (namespace `dashboard`, `en`/`id`)

`welcome`, `subtitle`, `role.{member,organization}`, `stats.{upcomingEvents,publishedStories}`, `section.upcomingEvents.{title,subtitle,viewAll,empty}`, `section.stories.{title,subtitle,viewAll,empty}`, `card.{noThumbnail,openStory}`. Key lama (`nav.*`, `group.*`, `userMenu.*`, `title`, `empty`) tetap.

## 10b. Konten Dashboard (admin)

Blok tambahan di `/` yang **hanya** dirender untuk admin. Deteksi admin berbasis permission (tanpa nama role): `isAdmin = canAny(['event:approve','event:reject','event:publish','event:unpublish'])` via `useAuthPermissions()` — sepadan scope `all` backend (sama dengan dispatcher `/events`). Role member/org melihat dua kartu statistik lama (`stats.upcomingEvents`, `stats.publishedStories`) tanpa perubahan. **Layout admin = stats + Pending Events + Pending Archives saja**; section Upcoming Events/Stories/Archives kini non-admin-only (lihat §10f).

### Data source

Semua query admin-gated dengan `enabled: isAdmin` (query key tidak berubah; `enabled` tidak masuk queryKey).

| Data | Query | Endpoint |
| --- | --- | --- |
| Event menunggu persetujuan | `useEvents({ page: pendingEventsPage, limit: 5, filter: { status: 'REQUEST' }, enabled: isAdmin })` | `GET /events?page=<n>&limit=5&filter[status]=REQUEST` |
| Total event | `useEvents({ page: 1, limit: 1, enabled: isAdmin })` → `.data?.total` | `GET /events?page=1&limit=1` |
| Total story | `useStories({ page: 1, limit: 1, enabled: isAdmin })` → `.data?.total` | `GET /posts?page=1&limit=1` |
| Total member | `useUsers({ page: 1, limit: 1, enabled: isAdmin && canReadUsers })` → `.data?.total` (`canReadUsers = can('user:read')`) | `GET /users?page=1&limit=1` |

### Aksi approve/reject

- Endpoint khusus (bukan PATCH): `POST /events/:id/approve` (`event:approve`) dengan body opsional `{ publishedAt: <ISO8601> }` → `status = PUBLISHED`; `POST /events/:id/reject` (`event:reject`) → `status = DRAFT`. `APPROVED` **deprecated** (tidak dipakai lagi sebagai state antara; baris legacy tetap bisa dirender).
- API: `approveEvent(id, publishedAt)` (body JSON `{ publishedAt }`)/`rejectEvent(id)` di `features/event/api/events.ts`; hook `use-approve-event.ts` (`mutationFn ({ id, publishedAt })`, invalidate `['event']` + `['event', { id }]`)/`use-reject-event.ts` (pola `use-submit-event.ts`, tanpa toast).
- **Alur approve tidak lagi mutate langsung.** Klik **Setujui** → `setApproveTargetId(id)` → `PublishScheduleDialog` (`components/shared/publish-schedule-dialog.tsx`) terbuka: langkah 1 pilih `publishedAt` (ISO, `date-time-picker.tsx`; tombol "Lanjut" nonaktif bila kosong/`isPending`) → langkah 2 `AlertDialog` konfirmasi → `onConfirm(publishedAt)` → `approveEvent.mutate({ id, publishedAt }, …)`.
- Toast di call-site route (`dashboard-home.tsx`): `toastSuccess(t('event:toast.approved'|'rejected'))`; error non-422 `toastError(getApiErrorMessage(err, t('event:toast.approveFailed'|'rejectFailed')))`; 422 early-return `isValidationError`.
- Label dialog dari `event:publishDialog.*` (`title`, `description`, `dateLabel`, `datePlaceholder`, `confirmDescription`), `event:confirm.*` (`title`, `submit` sebagai tombol "Lanjut" — `common:actions.continue` tidak ada), `event:workflow.approve` (tombol konfirmasi), `common:actions.cancel`.
- `busyId` = `approveEvent.variables?.id` bila `isPending`, selain itu `rejectEvent.variables` bila `isPending` → menonaktifkan tombol aksi baris terkait.
- **Anti double-submit**: tombol Setujui/Tolak juga nonaktif selama list refetch (`pendingQuery.isFetching` diteruskan sebagai prop `isRefreshing`); komponen menggabungnya dengan `busyId` (`actionsDisabled = busy || isRefreshing`) + `aria-busy` pada baris yang sedang diproses.
- **Kartu statistik admin**: nilai per kartu `…` saat `isPending`, `—` saat `isError`, angka `.data.total` setelah ada; kartu Total Member hanya dirender bila `canReadUsers` (`user:read`), selaras dengan gate query-nya.

### Komponen baru

- `features/dashboard/components/dashboard-pending-events.tsx` — presentational murni (hanya `components/ui`, `components/shared`, `lib`; tanpa import `features/event`/`features/story`).
  - Props (exported `interface`): `items: DashboardPendingEventItem[]`, `isPending`, `isError`, `canApprove`, `canReject`, `isRefreshing?`, `onViewDetail(id)`, `onApprove(id)`, `onReject(id)`, `busyId?`, `className?`.
  - Tiap baris: thumbnail (fallback `ImageOff`), nama, `creatorName`, `dateLabel`, `Badge` "Diajukan" (`event:statusOptions.REQUEST`); tombol **Lihat detail** (`Eye`, selalu), **Setujui** (`Check`, gate `canApprove`), **Tolak** (`X`, gate `canReject`).
  - Loading → `Skeleton`; kosong → `section.pendingEvents.empty`; error → `section.pendingEvents.error` (muted).
- View type `DashboardPendingEventItem` di `features/dashboard/types.ts` (dashboard tetap bebas import lintas domain). Mapping di route: `creatorName = event.creator?.organization?.name ?? event.creator?.fullName ?? null`; `dateLabel = event.dates[0] ? formatEventDate(event.dates[0]) : null`.

### i18n (namespace `dashboard`, `en`/`id`)

`stats.{totalEvents,totalStories,totalMembers}`, `section.pendingEvents.{title,subtitle,viewAll,empty,error}`, `pending.{approve,reject,viewDetail,unknown}`. Namespace `event` ditambah `toast.{approved,rejected,approveFailed,rejectFailed}`.

## 10c. Konten Dashboard — Section Arsip

Section arsip tunggal di `/` untuk user **non-admin** yang memegang `archive:read` (gate `can('archive:read')`) — menampilkan **hanya arsip PUBLISHED** (`filter[status]=PUBLISHED`, yaitu yang punya `publishedAt`), tanpa scope `mine`. Untuk admin, section ini tidak dirender (§10f).

### Data source

| Data | Query | Endpoint |
| --- | --- | --- |
| Arsip PUBLISHED | `useArchives({ page: archivesPage, limit: 6, filter: { status: 'PUBLISHED' }, sortBy: 'publishedAt', sortOrder: 'desc', enabled: canReadArchives })` | `GET /archives?page=<n>&limit=6&filter[status]=PUBLISHED&sortBy=publishedAt&sortOrder=desc` |

- Hanya satu section **Arsip** (tanpa "Arsip Saya").
- Mapping ke view type lokal `DashboardArchiveItem` (`features/dashboard/types.ts`): `id`, `name`, `thumbnail`, `description` (`archive.description ?? null`), `categories` (`archive.categories.map(c => c.name)`), `type`, `publishedAt`. Field `status` **tidak** dipetakan — section hanya berisi PUBLISHED.
- Loading → `DashboardCardSkeleton`; kosong/error → pesan muted (`section.archives.*`), pola sama section lain.
- **Pagination (non-admin)**: state `archivesPage` + `DataTablePagination` (`page`, `limit=6`, `total=archivesQuery.data?.total`, `entityName=t('section.archives.title')`, `isPending=archivesQuery.isFetching`). Admin tidak dirender (lihat §10d).

### Komponen baru

- `features/dashboard/components/dashboard-archive-card.tsx` — presentational (hanya `components/ui`, `lib`, `i18n`; tanpa import `features/archive`). Gaya **folder/dossier** yang sengaja dibedakan dari kartu story/event: akar `group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm` + hover lift (`hover:-translate-y-1 hover:shadow-lg`).
  - **Tab folder** di tepi atas: `absolute top-0 left-4 h-1.5 w-16 rounded-b-full bg-primary` (dekoratif, `aria-hidden`) — penanda khas arsip/dossier.
  - Cover `aspect-[16/9] object-cover` (zoom `group-hover:scale-105`; fallback `bg-muted` + `ImageOff`, `card.noThumbnail`) + overlay gradien bawah `bg-gradient-to-t from-card via-card/40 to-transparent` yang menyatu ke body.
  - Overlay cover: **ribbon tipe** (`archive:typeOptions.*`, `TYPE_VARIANT`, kiri-atas) saja — pill status (`DRAFT/REQUEST/APPROVED/PUBLISHED`) **dihapus** karena section sudah hanya menampilkan PUBLISHED (`Badge` + `shadow-sm`).
  - Body (`flex flex-1 flex-col gap-3 p-4`): chip kategori aksen (`bg-primary/10 text-primary`, maksimal 3 tampil, sisanya `+N` `variant="outline"`), judul (`font-heading text-lg font-semibold line-clamp-2`), deskripsi (`line-clamp-3 text-sm text-muted-foreground`; fallback muted italic `card.noDescription`).
  - Footer (`mt-auto border-t pt-3`, `justify-between`): `CalendarDays` + `formatDateTime(publishedAt)` (kosong/invalid → `—`), lalu affordance baca `ArrowRight` `text-primary` yang bergeser saat hover (`group-hover:translate-x-0.5`, dekoratif `aria-hidden` — label aksesibel ada di `Link`).
  - Seluruh kartu klikabel via `Link` absolute `inset-0` ke `/archives/{id}` (`aria-label` `card.openArchive`) + `rounded-2xl` focus ring inset. Props `{ archive: DashboardArchiveItem; className? }`.

### i18n (namespace `dashboard`, `en`/`id`)

`section.archives.{title,subtitle,viewAll,empty,error}`, `card.{openArchive,noDescription}`. Key `section.myArchives.*` **dihapus** (en/id).

## 10d. Pagination section Story & Archives (non-admin)

- State `storiesPage`/`archivesPage` (mulai 1) di `dashboard-home.tsx`; hanya dipakai non-admin (`!isAdmin`).
- `useStories`/`useArchives` menerima `page` (state) + `limit: 6` (`MAX_ITEMS`).
- `DataTablePagination` dirender di bawah grid tiap section **hanya bila `!isAdmin`**: `page`, `limit=6`, `total={query.data?.total ?? 0}`, `entityName` = `section.stories.title`/`section.archives.title`, `isPending={query.isFetching}`, `onPrev`/`onNext` ubah state (±1, minimal 1).
- Pagination **disembunyikan** saat query `isError`/`isPending` atau daftar kosong — mencegah pagination kosong (§10g).
- **Admin**: perilaku lama tanpa pagination (page tetap 1). Reset halaman tidak diperlukan selain prev/next.

## 10e. Kartu Event Highlight (non-admin, shared)

Grid **Event Akan Datang** (hanya render non-admin, §10f) memakai `EventHighlightCard`:

- **`EventHighlightCard`** (**shared**, `src/components/shared/event-highlight-card.tsx`): kartu media penuh — cover `aspect-[16/10]`, **chip tanggal mengambang** kiri-atas, dan **overlay gradien** di bawah berisi judul + lokasi (`MapPin`) + badge tipe. Layout sengaja dibuat jelas berbeda dari kartu Story/Archive (yang teks di bawah gambar). Komponen **sama** juga dipakai halaman Event non-admin (`event-month-section.tsx`, lihat `docs/module/event.md` §11) — karena itu dipromosikan ke `components/shared/`.

API (flat props, presentational murni tanpa import lintas domain):

```ts
interface EventHighlightCardProps {
  id: string
  name: string
  thumbnail: string | null
  date: string | null
  locationName: string | null
  eventTypes: string[]
  className?: string
}
```

Perilaku/UX:

- Akar kartu `group relative overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm` + `transition hover:-translate-y-0.5 hover:shadow-md`; cover punya `transition duration-300 group-hover:scale-105` (zoom halus).
- Tanpa thumbnail → panel `bg-muted` + `ImageOff` (reuse `common:eventCard.noThumbnail`).
- Chip tanggal: `bg-background/90 backdrop-blur` + border, angka hari besar + bulan pendek; dibentuk dari `date` via helper shared `lib/datetime.ts:formatDayMonth(iso)` → `{ day, month }` (locale browser, invalid → `'—'`/`''`, baca komponen UTC agar hari event tidak bergeser).
- Overlay: `bg-gradient-to-t from-foreground/80 via-foreground/30 to-transparent`; judul `text-background line-clamp-2`, lokasi `text-background/80`, badge tipe `variant="secondary"`.
- Seluruh kartu klikabel via `Link` absolute `inset-0` ke `/events/:id` dengan `aria-label` `common:eventCard.openEvent` + `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset` (pola sama kartu lain).
- Responsive mengikuti grid `CARD_GRID_CLASS` (`sm:grid-cols-2 xl:grid-cols-3`) — aman di mobile.

Data:

- View type `DashboardEventItem` (`features/dashboard/types.ts`) punya `date: string | null` (ISO jadwal terdekat) di samping `dateLabel`; diisi di `dashboard-home.tsx` dari `upcomingDate.date`. `dashboard-home.tsx` memetakan `DashboardEventItem` → flat props `EventHighlightCard`.
- i18n dari namespace **`common`**: `eventCard.{noThumbnail,noLocation,openEvent}` (bukan lagi `dashboard:card.*`). Key `dashboard:card.{noDate,noLocation,openEvent}` **dihapus** bersama `dashboard-event-card.tsx` (admin).

## 10f. Pemisahan Layout Admin vs Non-Admin

Dashboard home (`dashboard-home.tsx`) kini memisahkan **layout admin** dan **non-admin** secara eksplisit:

- **Admin** (`isAdmin = canAny(['event:approve','event:reject','event:publish','event:unpublish'])`) merender **hanya**: baris statistik (Total Event/Story/Member) + section **Event Menunggu Persetujuan** + section **Arsip Menunggu Persetujuan**. Section Upcoming Events / Latest Stories / Latest Archives **tidak** dirender untuk admin (dibungkus `{!isAdmin && (...)}`).
- **Non-admin** merender baris statistik (Event Akan Datang/Story Terbit) + section Upcoming Events + Stories + Archives, lengkap dengan `DataTablePagination` masing-masing — perilaku & pagination tidak berubah.
- Moderator arsip dideteksi terpisah: `isArchiveModerator = canAny(['archive:approve','archive:reject'])` (independen dari `isAdmin`).

### Section Pending Archives

| Data | Query | Endpoint |
| --- | --- | --- |
| Arsip menunggu persetujuan | `useArchives({ page: pendingArchivesPage, limit: 5, filter: { status: 'REQUEST' }, enabled: isArchiveModerator })` | `GET /archives?page=<n>&limit=5&filter[status]=REQUEST` |

- Section `DashboardSection` "Pending Archives" hanya dirender bila `isArchiveModerator`.
- Mapping ke view type lokal `DashboardPendingArchiveItem` (`features/dashboard/types.ts`): `id`, `name`, `thumbnail`, `creatorName` (`archive.creator?.fullName ?? null`), `description` (`?? null`), `categories` (`archive.categories.map(c => c.name)`).
- **Aksi**:
  - **Lihat detail** → `navigate('/archives/' + id)`.
  - **Tolak** → `useRejectArchive().mutate(id, …)` (toast `archive:toast.rejected` / `archive:toast.rejectFailed`).
  - **Setujui** → `setArchiveApproveTargetId(id)` → `PublishScheduleDialog` **instance terpisah** (dialog event tetap untuk event) → `useApproveArchive().mutate({ id, publishedAt }, …)` (toast `archive:toast.approved` / `archive:toast.approveFailed`). 422 early-return `isValidationError`.
- `archiveBusyId` = `approveArchive.variables?.id` / `rejectArchive.variables` saat `isPending`, digabung dengan `pendingArchivesQuery.isFetching` (prop `isRefreshing`) untuk menonaktifkan tombol (anti double-submit) — pola identik Pending Events.
- Komponen `features/dashboard/components/dashboard-pending-archives.tsx`: presentational (hanya `components/ui`, `lib`; tanpa import `features/archive`), struktur baris sama dengan `dashboard-pending-events.tsx` (thumbnail + `ImageOff`, nama + `Badge` `archive:statusOptions.REQUEST`, creator, baris deskripsi/kategori, tombol Lihat detail/Setujui/Tolak). Loading → `Skeleton`; kosong/error → `section.pendingArchives.*`.

### i18n tambahan (namespace `dashboard`, `en`/`id` sama)

`section.pendingArchives.{title,subtitle,viewAll,empty,error}`. Label tombol reuse `pending.*`; dialog reuse `archive:publishDialog.*`, `archive:confirm.{title,submit}`, `archive:workflow.approve`, `common:actions.cancel`.

## 10g. Hapus "Lihat semua" + Pagination di SEMUA section

- **Semua tautan "Lihat semua" dihapus**: props `viewAllLabel`/`viewAllTo` tidak dipakai lagi di setiap `<DashboardSection>` (`dashboard-home.tsx`) — Pending Events, Pending Archives, Upcoming Events, Stories, Archives. Props tetap ada di `dashboard-section.tsx` (opsional) untuk kompatibilitas, tetapi tidak ada consumer.
- **Pagination di seluruh section**:
  - **Pending Events** (admin): state `pendingEventsPage`, query `useEvents({ page: pendingEventsPage, limit: 5, filter: { status: 'REQUEST' }, enabled: isAdmin })`, `DataTablePagination` `total={pendingQuery.data?.total ?? 0}` `entityName=t('section.pendingEvents.title')`.
  - **Pending Archives** (moderator): state `pendingArchivesPage`, query `useArchives({ page: pendingArchivesPage, limit: 5, filter: { status: 'REQUEST' }, enabled: isArchiveModerator })`, `DataTablePagination` `total={pendingArchivesQuery.data?.total ?? 0}` `entityName=t('section.pendingArchives.title')`.
  - **Upcoming Events** (non-admin): pipeline lama (fetch 100 PUBLISHED + filter upcoming + sort tanggal terdekat) **tanpa** `slice(0,6)`; pagination **client-side** dengan state `eventsPage` dan `PAGE = MAX_ITEMS (6)`: render `events.slice((eventsPage-1)*PAGE, eventsPage*PAGE)`, `DataTablePagination` `total={events.length}` `entityName=t('section.upcomingEvents.title')`.
  - **Stories / Archives**: tidak berubah (§10d).
- **Clamp halaman**: `useEffect` menurunkan `eventsPage`/`pendingEventsPage`/`pendingArchivesPage` ke halaman maksimum saat daftar menyusut (mis. setelah approve/reject item terakhir). Pola sama dengan `events.tsx`/`archives.tsx` (komentar `eslint-disable-next-line react-hooks/set-state-in-effect`).
- **Guard render pagination**: hanya dirender bila `!query.isError && !query.isPending` dan daftar tidak kosong — tidak ada pagination kosong saat error/loading/empty.

## 11. Status & Catatan

- **Iterasi-1** (brief ini): shell + navigasi + tema + logout; halaman dashboard/user/roles kosongan. ✅ Selesai.
- **Iterasi konten dashboard** (§10a): home diisi hero + statistik + event akan datang + story terbaru (member/org); API list event/story ditambah param `upcoming` + `filter` (backward compatible). ✅ Selesai.
- **Iterasi dashboard admin** (§10b): blok admin-only — 3 kartu statistik (total event/story/member) + seksi "Event Menunggu Persetujuan" dengan aksi Lihat detail/Setujui/Tolak via endpoint khusus `POST /events/:id/approve|reject`. ✅ Selesai.
- **Iterasi dashboard arsip** (§10c): section tunggal **Arsip** (semua yang boleh dibaca) untuk pemegang `archive:read` — **Arsip Saya** (`mine=true`) dihapus. ✅ Selesai.
- **Iterasi pagination section** (§10d): pagination pada section **Story** & **Archives** untuk non-admin. ✅ Selesai.
- **Iterasi kartu event highlight** (§10e): grid Event Akan Datang non-admin memakai `EventHighlightCard` (kartu media + chip tanggal + overlay gradien). `DashboardEventItem` punya `date`; helper `formatDayMonth` di `lib/datetime.ts`. ✅ Selesai.
- **Iterasi shared highlight card**: `dashboard-event-highlight-card.tsx` **dihapus**; komponen dipromosikan ke `src/components/shared/event-highlight-card.tsx` (flat props, i18n `common:eventCard.*`) agar dipakai bersama dashboard (non-admin) **dan** halaman Event non-admin (`event-month-section.tsx`). `dashboard-home.tsx` memetakan `DashboardEventItem` → props flat. ✅ Selesai.
- **Iterasi hapus kartu event admin**: `dashboard-event-card.tsx` (`DashboardEventCard`) **dihapus** — admin dashboard tidak lagi merender grid Event Akan Datang (§10f). Key i18n `dashboard:card.{noDate,noLocation,openEvent}` ikut dihapus (en/id). `DashboardEventItem` tetap dipakai pemetaan highlight non-admin (`dashboard-home.tsx`). ✅ Selesai.
- **Iterasi kartu arsip** (§10c): kartu arsip didesain ulang bergaya dokumen/dossier (thumbnail + kategori + judul + deskripsi + ribbon tipe + footer tanggal), dibedakan dari kartu story/event. `DashboardArchiveItem` ditambah `description` + `categories`. ✅ Selesai.
- **Iterasi polish kartu arsip** (§10c): motif **folder/dossier** (`rounded-2xl` + tab lengkung atas + cover gradien menyatu body + ribbon tipe + footer tanggal/affordance baca), membedakannya makin tegas dari kartu story/event. Tanpa i18n baru. ✅ Selesai.
- **Iterasi hapus pill status kartu arsip** (§10c): pill status (`archive:statusOptions.*` + `STATUS_VARIANT`) dihapus dari `dashboard-archive-card.tsx` — redundant karena section hanya menampilkan PUBLISHED. Field `status` + type `DashboardArchiveStatus` dihapus dari `DashboardArchiveItem` (sudah tidak dipakai di dashboard). Kept: ribbon tipe. ✅ Selesai.
- **Iterasi layout admin + Pending Archives** (§10f): layout admin disederhanakan (stats + Pending Events + **Pending Archives**); Upcoming Events/Stories/Archives dibungkus `{!isAdmin && (...)}` (non-admin saja). `isArchiveModerator = canAny(['archive:approve','archive:reject'])`; query `useArchives({ filter: { status: 'REQUEST' }, enabled: isArchiveModerator })`; komponen `dashboard-pending-archives.tsx`; approve via `PublishScheduleDialog` instance kedua + `useApproveArchive`, reject via `useRejectArchive`. ✅ Selesai.
- **TODO iterasi berikutnya**: chart Recharts lewat `pnpm dlx shadcn@latest add chart` bila dibutuhkan (data belum tersedia).
- **Catatan implementasi**:
  - Komponen `sidebar`, `dropdown-menu`, `avatar`, `breadcrumb`, `separator`, `skeleton`, `tooltip` (+ `sheet` dan `src/hooks/use-mobile.ts` sebagai dependensi) dibuat via CLI `pnpm dlx shadcn@latest add sidebar dropdown-menu avatar breadcrumb separator skeleton tooltip`.
  - `src/hooks/use-mobile.ts` (hasil generate CLI) di-tuning ringan: `setState` sinkron di dalam `useEffect` diganti lazy initializer agar lolos rule lint `react-hooks/set-state-in-effect`; perilaku tidak berubah.
  - Data user + logout **dipass via props** dari container route (`src/app/routes/dashboard.tsx` memakai `useAuth()`), bukan dipanggil langsung di `features/dashboard` — menjaga aturan "tanpa import lintas domain" (AGENTS.md §Reusable Component & brief §10).
  - `TooltipProvider` (`delayDuration={0}`) dibungkus di `app-shell.tsx` karena `SidebarMenuButton` memakai tooltip saat sidebar collapsed.
  - Anti-flash theme: inline `<script>` di `frontend/index.html` set class `dark` sebelum React mount, sinkron dengan `useTheme` (`localStorage['theme']`, fallback `prefers-color-scheme`). Tanpa dependency baru.
  - **Sidebar hidden pada route editor story**: `app-shell.tsx` punya branch `isStoryEditor` untuk `/stories/new` & `/stories/:id/edit` (layout tanpa sidebar, header ringkas + breadcrumb Dashboard / Story / judul) — lihat `docs/module/story.md` §2/§8. Tidak ada config baru; murni `pathname`.