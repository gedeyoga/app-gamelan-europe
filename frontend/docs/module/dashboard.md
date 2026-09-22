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
| Event akan datang | `useEvents({ page: 1, limit: 50, filter: { status: 'PUBLISHED' }, upcoming: true, sortBy: 'publishedAt', sortOrder: 'desc' })` | `GET /events?page=1&limit=50&filter[status]=PUBLISHED&upcoming=true&sortBy=publishedAt&sortOrder=desc` |
| Story terbaru | `useStories({ page: 1, limit: 6, filter: { status: 'PUBLISHED' }, sortBy: 'publishedAt', sortOrder: 'desc' })` | `GET /posts?page=1&limit=6&filter[status]=PUBLISHED&sortBy=publishedAt&sortOrder=desc` |

- Serialisasi `filter` = `search.set(\`filter[${key}]\`, value)` (parser Express `extended`). `upcoming=true` → `search.set('upcoming','true')`.
- Mapping event: pilih tanggal **terdekat ≥ sekarang** (`new Date(iso).getTime()`), buang event tanpa tanggal mendatang, urut naik, ambil 6. Mapping story: `categories[].name`, `creator.fullName`, `publishedAt`.
- Kartu statistik: `eventsQuery.data.total` (Event Akan Datang) + `storiesQuery.data.total` (Story Terbit). Tanpa kartu ketiga (data tidak tersedia → tidak mengarang).
- Loading → skeleton; error/empty → empty-state muted (tanpa teks error mentah).

### Komponen Baru (`src/features/dashboard/components/`)

- `dashboard-hero.tsx` — banner gradient (`from-primary/10 via-primary/5 to-transparent`), greeting `welcome` + badge role.
- `dashboard-stat-card.tsx` — `icon: LucideIcon` + label + value besar + `hint?`.
- `dashboard-section.tsx` — wrapper section (title/subtitle/`viewAllTo`+`viewAllLabel`/`empty`/children).
- `dashboard-event-card.tsx` — thumbnail (fallback `ImageOff`), judul, tanggal+jam, lokasi, badge tipe; link `/events/{id}`, hover lift.
- `dashboard-story-card.tsx` — thumbnail, judul, badge kategori, author, tanggal; link `/stories/{id}`.
- `dashboard-skeletons.tsx` — `DashboardCardSkeleton`.

### i18n (namespace `dashboard`, `en`/`id`)

`welcome`, `subtitle`, `role.{member,organization}`, `stats.{upcomingEvents,publishedStories}`, `section.upcomingEvents.{title,subtitle,viewAll,empty}`, `section.stories.{title,subtitle,viewAll,empty}`, `card.{noThumbnail,noDate,noLocation,openEvent,openStory}`. Key lama (`nav.*`, `group.*`, `userMenu.*`, `title`, `empty`) tetap.

## 11. Status & Catatan

- **Iterasi-1** (brief ini): shell + navigasi + tema + logout; halaman dashboard/user/roles kosongan. ✅ Selesai.
- **Iterasi konten dashboard** (§10a): home diisi hero + statistik + event akan datang + story terbaru (member/org); API list event/story ditambah param `upcoming` + `filter` (backward compatible). ✅ Selesai.
- **TODO iterasi berikutnya**: chart Recharts lewat `pnpm dlx shadcn@latest add chart` bila dibutuhkan (data belum tersedia).
- **Catatan implementasi**:
  - Komponen `sidebar`, `dropdown-menu`, `avatar`, `breadcrumb`, `separator`, `skeleton`, `tooltip` (+ `sheet` dan `src/hooks/use-mobile.ts` sebagai dependensi) dibuat via CLI `pnpm dlx shadcn@latest add sidebar dropdown-menu avatar breadcrumb separator skeleton tooltip`.
  - `src/hooks/use-mobile.ts` (hasil generate CLI) di-tuning ringan: `setState` sinkron di dalam `useEffect` diganti lazy initializer agar lolos rule lint `react-hooks/set-state-in-effect`; perilaku tidak berubah.
  - Data user + logout **dipass via props** dari container route (`src/app/routes/dashboard.tsx` memakai `useAuth()`), bukan dipanggil langsung di `features/dashboard` — menjaga aturan "tanpa import lintas domain" (AGENTS.md §Reusable Component & brief §10).
  - `TooltipProvider` (`delayDuration={0}`) dibungkus di `app-shell.tsx` karena `SidebarMenuButton` memakai tooltip saat sidebar collapsed.
  - Anti-flash theme: inline `<script>` di `frontend/index.html` set class `dark` sebelum React mount, sinkron dengan `useTheme` (`localStorage['theme']`, fallback `prefers-color-scheme`). Tanpa dependency baru.
  - **Sidebar hidden pada route editor story**: `app-shell.tsx` punya branch `isStoryEditor` untuk `/stories/new` & `/stories/:id/edit` (layout tanpa sidebar, header ringkas + breadcrumb Dashboard / Story / judul) — lihat `docs/module/story.md` §2/§8. Tidak ada config baru; murni `pathname`.