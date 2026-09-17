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

## 4. Sidebar (AppSidebar)

- **SidebarHeader**: brand "trade-app".
- **SidebarContent** (navigasi):
  - Nav item **Dashboard** (ikon lucide `Home`) — default active.
  - Group **Data Management**:
    - **User** → `/users` (ikon `Users`).
    - **Roles** → `/roles` (ikon `Shield`).
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

## 11. Status & Catatan

- **Iterasi-1** (brief ini): shell + navigasi + tema + logout; halaman dashboard/user/roles kosongan. ✅ Selesai.
- **TODO iterasi-2**: statistik dashboard (kartu, chart Recharts lewat `pnpm dlx shadcn@latest add chart`), halaman CRUD User & Roles — menunggu kontrak endpoint backend.
- **Catatan implementasi**:
  - Komponen `sidebar`, `dropdown-menu`, `avatar`, `breadcrumb`, `separator`, `skeleton`, `tooltip` (+ `sheet` dan `src/hooks/use-mobile.ts` sebagai dependensi) dibuat via CLI `pnpm dlx shadcn@latest add sidebar dropdown-menu avatar breadcrumb separator skeleton tooltip`.
  - `src/hooks/use-mobile.ts` (hasil generate CLI) di-tuning ringan: `setState` sinkron di dalam `useEffect` diganti lazy initializer agar lolos rule lint `react-hooks/set-state-in-effect`; perilaku tidak berubah.
  - Data user + logout **dipass via props** dari container route (`src/app/routes/dashboard.tsx` memakai `useAuth()`), bukan dipanggil langsung di `features/dashboard` — menjaga aturan "tanpa import lintas domain" (AGENTS.md §Reusable Component & brief §10).
  - `TooltipProvider` (`delayDuration={0}`) dibungkus di `app-shell.tsx` karena `SidebarMenuButton` memakai tooltip saat sidebar collapsed.
  - Anti-flash theme: inline `<script>` di `frontend/index.html` set class `dark` sebelum React mount, sinkron dengan `useTheme` (`localStorage['theme']`, fallback `prefers-color-scheme`). Tanpa dependency baru.