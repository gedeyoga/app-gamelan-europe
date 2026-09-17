# Module: Profile — Brief

Dokumen ini mencatat rencana desain/implementasi halaman **User Profile (self)** pada frontend React — menampilkan profil user yang sedang login (read-only) + section ganti password (stub). Mengikuti konvensi `frontend/AGENTS.md` dan meniru pola brief `docs/module/user.md` & `docs/module/dashboard.md`.

## 1. Tujuan & Ruang Lingkup

- Menyediakan halaman **self-profile** di `/profile` — identitas user login + role + permissions + form ganti password.
- **Read-only untuk saat ini**: backend belum menyediakan endpoint self-service (lihat §5). Tidak ada edit nama/email — hanya tampil.
- Section ganti password: **form + state handler tersedia** (UX siap), tapi mutation **di-stub** sampai backend tersedia (banner `profile:errors.changePasswordNotAvailable`). Tidak mengisi form palsu atau memanggil endpoint admin (`PATCH /users/:id`) yang akan memperbarui user lain.
- Konsumsi API: `GET /api/v1/auth/me` (kontrak final, lihat `backend/docs/modules/auth.md` §`/auth/me`). Data sesi dari `useAuth()` dipakai sebagai initial render untuk mencegah loading flash.
- **Di luar lingkup**: edit nama/email sendiri, upload avatar, kelola perangkat sesi (refresh token list), 2FA.

## 2. Routing

- Route baru nested di bawah `DashboardLayout` (parent `/` → `ProtectedRoute`) di `src/app/routes/index.tsx`.
- **LOGIN-only** via `ProtectedRoute` — **tanpa** `<RequirePermission code=...>` (semua user login boleh lihat profil sendiri). Tidak ada kode permission spesifik untuk halaman ini.

```
/  (parent → AppShell + ProtectedRoute)
├── /                 index  → Dashboard home
├── /users            → User CRUD (RequirePermission user:read)
├── /roles            → Roles CRUD (RequirePermission role:read)
├── /profile          → User Profile (self) — LOGIN-only, no permission gate
└── /403              → ForbiddenPage
```

Container: `src/app/routes/profile.tsx` (`ProfilePage`).

## 3. Struktur File

YAGNI: hanya buat yang dipakai. Info profil cukup 1 card — tidak dipisah-pisah.

```
src/app/routes/profile.tsx                     # container: panggil useSession + useChangePassword, wire toast

src/features/profile/
├── types.ts                                   # ChangePasswordInput (SessionUser di-import dari @/features/auth/types)
├── api/profile-api.ts                         # changePassword() (stub) — getMe TIDAK di sini (pakai useSession)
├── hooks/
│   └── use-change-password.ts                 # useMutation: mutationFn=changePassword, onSuccess invalidate ['auth','me']
└── components/
    ├── profile-card.tsx                       # card info: nama/email/status/role/permissions
    └── change-password-card.tsx               # section ganti password (rhf+zod), terima onSubmit(values) prop
```

**Tidak** dibuat: `hooks/use-me.ts` (pakai `useSession`), `permissions-list.tsx` (rendam di `profile-card.tsx`), `change-password-dialog.tsx` terpisah, AlertDialog konfirmasi (submit langsung → mutation).

**Alasan YAGNI**:
- `useSession` sudah ada (rencana di `docs/AUTH_PAGES.md` §6 — `features/auth/hooks/useSession.ts` dengan key `['auth', 'me']`, `staleTime 60s`, retry anti-401). Pakai itu. Tambah `useMe` baru = duplikat + dua query `['auth','me']` & `['profile','me']` yang fetch endpoint sama.
- Daftar permission cukup list `<Badge>` ringkas dalam `profile-card.tsx` — tidak perlu komponen scroll terpisah.
- `useChangePassword` di file terpisah sesuai AGENTS.md (mutation hook di `features/<domain>/hooks/`); walau satu call-site, file hook memudahkan reuse jika modul lain butuh ganti password, dan konsistensi pola `useCreateUser`/`useDeleteRole`.
- Submit langsung → mutation: AlertDialog konfirmasi = interaksi ekstra tanpa nilai (user sudah di form ganti password, tombol "Simpan" = konfirmasi implisit); inkonsisten dengan modul CRUD lain (User/Role submit tanpa konfirmasi).

## 4. Komponen yang Ditambah (via CLI)

Periksa dulu `src/components/ui/`:

| Komponen | Status | Aksi |
| --- | --- | --- |
| `card` | ✅ sudah tersedia | — |
| `badge` | ✅ sudah tersedia | — |
| `form`, `input`, `button`, `label`, `dialog` | ✅ sudah tersedia | — |
| `alert-dialog` | ✅ sudah tersedia | — |

Tidak ada CLI add baru. Larang edit manual `src/components/ui/` (AGENTS.md & DESIGN_SYSTEM.md).

## 5. Kontrak API

### `GET /api/v1/auth/me` (final, dipakai)

- Akses: **LOGIN-only** (Bearer). 401 → redirect `/login` lewat `lib/api-client.ts` (existing).
- Response 200: `{ data: { id, email, fullName, status, role: {id,name} | null, permissions: string[] }, message }`.
- Envelope: `{ data, message }` (di-unwrap oleh `request()` di `lib/api-client.ts`).
- **Tanpa `createdAt`/`updatedAt`** saat ini — backend `auth.service.me()` (`backend/apps/app/src/controllers/auth.controller.ts` + `libs/src/core/auth/auth.service.ts`) mengembalikan entity `UserSelect` ringkas. Catat TODO backend untuk tambah timestamps. FE siapkan slot tampilan `createdAt`/`updatedAt` (akan render `'—'` jika absent via `formatDateTime` dari `@/lib/datetime`).

### `POST /api/v1/auth/change-password` — **TIDAK ADA, TODO backend**

Cek `backend/apps/app/src/controllers/auth.controller.ts`: hanya ada `register`, `login`, `refresh`, `logout`, `me`. Tidak ada endpoint ganti password sendiri.

**TODO backend** (catat, JANGAN kerjakan di FE):
- Endpoint baru `POST /api/v1/auth/change-password` (LOGIN-only, body `{ currentPassword, newPassword }`).
- Service: `authService.changePassword(userId, currentPassword, newPassword)` — verify `currentPassword` via argon2id, hash `newPassword`, update `users.password_hash`. Invalidate seluruh family refresh token user (mirror pola reuse detection — `backend/docs/modules/auth.md` §4) supaya token yang ada ter-revoke.
- Response 200 `{ data: null, message }`. Error: 401 (currentPassword salah / sesi invalid), 422 (validasi DTO min 8 / max 128).
- DTO baru `libs/src/core/auth/dto/change-password.dto.ts` dengan validator `class-validator`.

**Strategi FE iterasi-1**:
- `changePassword()` di `features/profile/api/profile-api.ts` di-**stub** — `return Promise.reject(new Error('changePasswordNotAvailable'))` (atau `ApiError` 501 kalau backend menyediakan kode tertentu; default pakai `Error` generic untuk konsistensi). Jangan panggil endpoint fiktif.
- UI tetap render form lengkap dengan validasi client-side. Saat submit → tangkap rejection → tampilkan banner `profile:errors.changePasswordNotAvailable` + toast `profile:toast.changePasswordFailed`. Form tetap usable; user tahu fitur belum siap.

### `PATCH /api/v1/auth/me` (self-update nama/email) — **TIDAK ADA, TODO backend**

Catat TODO terpisah (di luar iterasi-1). Dampak: nama/email tampil read-only; tidak ada tombol "Edit Profil".

### **LARANG** pakai endpoint admin untuk self

- `PATCH /api/v1/users/:id` butuh permission `user:update`, hanya untuk admin mengubah user lain. Memakainya untuk self akan salah sasaran (memperbarui user lain atau kena 403). JANGAN dipakai.

## 6. Konvensi (AGENTS.md)

- **Data source**: pakai `useSession` dari `features/auth/hooks/useSession.ts` (sesuai `docs/AUTH_PAGES.md` §6) — `useQuery` key `['auth', 'me']`, `queryFn: authApi.me`, `staleTime: 60s`, `retry: (count, err) => err instanceof ApiError && err.statusCode === 401 ? false : count < 1`. File `useSession.ts` belum ada di repo saat brief ditulis — buat saat implementasi sesuai pola yang dijelaskan di AUTH_PAGES.md (cek `features/auth/api/authApi.ts` untuk `me`).
- **Initial render tanpa flash**: `useAuth().user` (state `AuthProvider` dari `localStorage['auth.user']` yang sudah di-hydrate saat login) dipakai sebagai `placeholderData` di `useSession` sehingga card langsung render saat navigasi ke `/profile`. `useSession` tetap fetch di background untuk server-truth (refetch on stale/mount). **`useSession` hook belum ada di repo** saat brief ini ditulis — iterasi-1: buat `features/auth/hooks/useSession.ts` sesuai pola di `docs/AUTH_PAGES.md` §6 (cek `features/auth/api/authApi.ts` untuk `me`). Jika sudah ada, langsung pakai.
- **Mutation stub**: `useChangePassword` hook di `features/profile/hooks/use-change-password.ts` (sesuai AGENTS.md TanStack Query: mutation hook di `features/<domain>/hooks/`, `queryFn`/api dipisah). Hook berisi `useMutation({ mutationFn: changePassword, onSuccess: invalidate ['auth','me'] })` — **tanpa toast di dalam hook**. Container `profile.tsx` panggil hook lalu `mutate(..., { onSuccess, onError })` dengan `onSuccess → toastSuccess(t('profile:toast.passwordChanged'))` (saat endpoint tersedia) dan `onError` non-422 → `toastError(getApiErrorMessage(err, t('profile:toast.changePasswordFailed')))` + tampilkan banner `profile:errors.changePasswordNotAvailable`. Iterasi-1 reject selalu terjadi (stub) → alur `onError` yang utama. Toast di **call-site** (`profile.tsx`), bukan di hook — sesuai AGENTS.md Toast Feedback.
- **Form**: `react-hook-form` + `zod` (standar AGENTS.md). Schema di dalam komponen, `useMemo(..., [t])`. Field: `currentPassword`, `newPassword`, `confirmPassword` (refine `.refine((v) => v === data.newPassword, ...)` dengan pesan `t('validation:passwordConfirm')`). Pesan hanya dari `t('validation:*')`. Mirror DTO backend yang akan datang: `MinLength(8)`, `MaxLength(128)`, `Transform(trim)`.
- **Error 422**: `useEffect` map `mapApiFieldErrors(err)` dari `@/lib/field-errors` → `form.setError` per-field. **Tanpa toast**, **tanpa banner**, dialog/form tetap terbuka. `onError` mutation wajib `if (isValidationError(err)) return;`. Saat stub, reject bukan 422 → banner non-422 tampil.
- **Komponen presentational**: data via props (`interface`), `cn()` untuk className. Komponen `profile-card.tsx` & `change-password-card.tsx` menerima props (bukan fetch langsung). Container `profile.tsx` yang panggil hook + pass data.
- **Cross-feature import**: container `profile.tsx` boleh import dari `features/auth` untuk `useSession` (data dependency, sama pola `users.tsx` import `useRoles` dari `features/role`). Komponen `profile-card.tsx`/`change-password-card.tsx` **tetap presentational** — hanya boleh import dari `components/ui`, `components/shared`, `lib`, `i18n` (tanpa `features/auth/*`). Tipe `SessionUser` di komponen di-import dari `@/features/auth/types`, **bukan** re-declare di `features/profile/types.ts` (lihat §3).
- **Toast**: helper `@/lib/toast` (`toastSuccess`, `toastError`, `getApiErrorMessage`, `isValidationError`). Toast di **call-site** (`profile.tsx`), bukan di dalam hook.
- **Bahasa UI**: Indonesia. Proper-noun EN (`User Profile`, `Permission`, `Active`, `Blocked` — biarkan bila sudah dipakai di modul lain sebagai identifier).
- **Tanggal/waktu**: `formatDateTime` dari `@/lib/datetime` untuk `createdAt`/`updatedAt` bila backend menambahkannya. Saat ini field absent → tampil `'—'` (default helper).

### Trade-off `useSession` vs `useMe` baru (keputusan)

| Opsi | Pro | Kon |
| --- | --- | --- |
| Pakai `useSession` existing | DRY: 1 fetch `/auth/me` (atau 2 in-flight tapi di-dedup via `inFlightMe` module-scoped), konsisten dengan login flow, tidak ada cache drift antara session & profile | Key generic (`['auth','me']`) — bila nanti ada endpoint `/users/me` lain, key bentrok |
| Tambah `useMe` baru (`['profile','me']`) | Namespace jelas per domain, mudah invalidate granular untuk halaman ini | Duplikat fetch `/auth/me`; dua sumber kebenaran untuk data yang sama; `useAuth().user` jadi stale vs `useMe`; YAGNI |

**Keputusan**: **pakai `useSession`**. YAGNI menang. `change-password-card.tsx` setelah sukses (saat endpoint tersedia) tinggal `invalidateQueries({ queryKey: ['auth', 'me'] })` agar role/permissions konsisten bila backend invalidate sesi.

## 7. Sidebar Integration

- **Dropdown footer (`sidebar-user.tsx`)**: item "Pengaturan" (saat ini placeholder tanpa `onClick`) dijadikan `<DropdownMenuItem onSelect={() => navigate('/profile')}>` dengan ikon `Settings` (sudah ada). `SidebarUser` menerima prop tambahan `onOpenProfile?: () => void` (atau `useNavigate()` di-inject via `react-router-dom`); default opsional agar komponen tetap reusable. Wiring dilakukan di `dashboard.tsx` → `AppShell` → `AppSidebar` → `SidebarUser`.
- **Menu sidebar utama**: **JANGAN tambahkan** menu "Profile" di grup Dashboard/Data Management. Trade-off YAGNI: dropdown footer sudah cukup untuk navigasi self, dan menambah entri tanpa permission gate ke `dashboardNavItems` akan mengotori sidebar (group Dashboard berisi item home, bukan halaman self-service). Cukup dropdown.
- **Breadcrumb dinamis — wiring aktual**: `app-shell.tsx` memilih `currentItem` via `[...dashboardNavItems, ...visibleDataManagementNavItems].find(item => item.url === pathname)`. `/profile` **tidak** ada di kedua array → `currentItem = undefined` → breadcrumb hanya menampilkan "Dashboard" (tanpa segmen Profile). **Rekomendasi minimal**: tambahkan `else if (pathname === '/profile')` di builder `currentItem` (`app-shell.tsx`) yang hardcode-set `currentItem = { title: t('userMenu.profile'), url: '/profile' }` — tanpa menambah entry ke `dashboardNavItems`/`dataManagementNavItems` (sidebar tetap bersih). Alternatif yang DITOLAK: tambah `{ title: t('nav.profile'), url: '/profile' }` ke `dashboardNavItems` — otomatis muncul di breadcrumb **TAPI** juga tampil di sidebar (dua shortcut untuk satu tujuan, inkonsisten). Dropdown footer tetap sebagai cara utama navigasi ke `/profile`.

## 8. Permissions

| Aksi | Kode |
| --- | --- |
| Buka `/profile` | LOGIN-only via `ProtectedRoute` (tanpa kode permission) |
| Lihat card profil | otomatis (sudah login) |
| Submit ganti password | LOGIN-only — semua user login boleh ganti password sendiri (saat endpoint tersedia) |
| Menu dropdown "Pengaturan" → `/profile` | selalu tampil untuk user login (tanpa permission gate) |

Tidak ada kode permission baru di backend untuk iterasi-1 (backend hanya butuh generic `@Post('change-password')` di bawah `JwtAuthGuard` global — tanpa `@Permissions()`).

## 9. Toast Feedback

Key i18n namespace `profile:*`:

- `profile:toast.passwordChanged` — "Password berhasil diubah." (untuk saat endpoint tersedia)
- `profile:toast.changePasswordFailed` — "Gagal mengubah password." (default fallback toast error)
- `profile:errors.changePasswordNotAvailable` — "Fitur ganti password belum tersedia. Hubungi administrator." (banner + bisa di-toast saat stub reject)

Pattern panggilan (container `profile.tsx`) — `mutate` dipanggil dari container, **bukan** dari `change-password-card.tsx`. Card hanya terima prop `onSubmit(values: ChangePasswordInput)`:

```ts
// app/routes/profile.tsx (container)
const changePassword = useChangePassword()
const form = useForm<ChangePasswordInput>(/* ... */)

const handleSubmit = (values: ChangePasswordInput) => {
  changePassword.mutate(values, {
    onSuccess: () => {
      toastSuccess(t('profile:toast.passwordChanged'))
      form.reset()
    },
    onError: (err: unknown) => {
      if (isValidationError(err)) return // 422 → per-field, form tetap
      toastError(getApiErrorMessage(err, t('profile:toast.changePasswordFailed')))
    },
  })
}

return (
  <>
    <ProfileCard user={user} />
    <ChangePasswordCard onSubmit={handleSubmit} isPending={changePassword.isPending} />
  </>
)
```

`ChangePasswordCard` tetap presentational: `interface Props { onSubmit: (values: ChangePasswordInput) => void; isPending: boolean }`. Form submit langsung → `props.onSubmit(values)` → mutation dipanggil container. Tidak ada AlertDialog konfirmasi.

## 10. Status & Catatan

- **Iterasi-1 (brief ini)** — checklist:
    - [ ] `useSession` hook dibuat (`features/auth/hooks/useSession.ts`) sesuai `docs/AUTH_PAGES.md` §6 (kalau belum ada).
    - [ ] Route `/profile` di `src/app/routes/index.tsx` (nested, `ProtectedRoute`, tanpa `RequirePermission`).
    - [ ] Container `src/app/routes/profile.tsx` (`ProfilePage`) — panggil `useSession` + `useChangePassword`, render `<ProfileCard>` + `<ChangePasswordCard>`, wire `mutate` dengan `onSuccess`/`onError` toast.
    - [ ] `src/features/profile/types.ts` (`ChangePasswordInput` saja; `SessionUser` di-import dari `@/features/auth/types`).
    - [ ] `src/features/profile/api/profile-api.ts` (`changePassword()` stub `Promise.reject`).
    - [ ] `src/features/profile/hooks/use-change-password.ts` — `useMutation({ mutationFn: changePassword, onSuccess: invalidate ['auth','me'] })`, tanpa toast di dalam hook.
    - [ ] `src/features/profile/components/profile-card.tsx` — card info + permissions list + slot `createdAt`/`updatedAt` (render `'—'` saat absent); import `SessionUser` dari `@/features/auth/types`.
    - [ ] `src/features/profile/components/change-password-card.tsx` — form rhf+zod + AlertBanner saat stub; props `{ onSubmit, isPending }`. **Tanpa** AlertDialog konfirmasi.
    - [ ] i18n keys di `src/i18n/locales/{en,id}/profile.json` + daftarkan di `src/i18n/index.ts` (import + tambah `profile` ke `ns`).
    - [ ] `SidebarUser` terima `onOpenProfile` (atau inject `useNavigate`) → item "Pengaturan" navigate ke `/profile`.
    - [ ] `app-shell.tsx` tambah `else if (pathname === '/profile') currentItem = { title: t('userMenu.profile'), url: '/profile' }` di builder `currentItem` (lihat §7).
    - [ ] Error state 401 (auto redirect), 403 (tidak relevan untuk `/profile` — tetap tangani `isForbiddenError`), 500 (banner "Gagal memuat profil"). **Klarifikasi 401-redirect**: 401 dari `/auth/me` di-handle oleh `lib/api-client.ts` → `expireSession()` + dispatch event `auth:expired` → `AuthProvider` set state `unauthenticated` → `<ProtectedRoute>` redirect ke `/login` (existing flow). **`useSession` sendiri tidak redirect** — query-nya hanya return error, redirect terjadi via `ProtectedRoute` di atas route.
    - [ ] Lint + tsc bersih (`pnpm lint`, `pnpm tsc --noEmit`).

- **TODO backend** (catat, JANGAN kerjakan FE):
    - `POST /api/v1/auth/change-password` — body `{ currentPassword, newPassword }`; argon2id verify + update; revoke seluruh family refresh token; response 200 + error 401/422.
    - `PATCH /api/v1/auth/me` — body `{ fullName?, email? }` (self-update nama/email).
    - Tambah `createdAt`/`updatedAt` di response `GET /auth/me` (extend `userSelect` atau entity khusus).

- **Catatan implementasi**:
    - `useAuth().user` (dari `localStorage['auth.user']` hasil hydrate saat login) dipakai sebagai `placeholderData` di `useSession` — tidak ada loading flash. `useSession` tetap fetch di background agar data server-truth.
    - Banner `changePasswordNotAvailable` memakai `Alert` shadcn/ui atau div `role="alert"` merah — pola sama dengan banner `roleErrorKind` di `users.tsx`. State `showUnavailableBanner` di `change-password-card.tsx`; muncul setelah submit pertama yang reject (agar tidak mengganggu render awal).
    - `createdAt`/`updatedAt`: meski saat ini absent dari response, sediakan slot di `ProfileCard` dengan `formatDateTime(user.createdAt, '—')` agar tinggal enable saat backend menambahkannya — tanpa refactor.
    - `useChangePassword` di file hook terpisah (`features/profile/hooks/use-change-password.ts`) sesuai AGENTS.md (mutation hook di `features/<domain>/hooks/`); hook berisi `useMutation({ mutationFn: changePassword, onSuccess: invalidate ['auth','me'] })` tanpa toast. Container panggil hook + pasang toast `onSuccess`/`onError`.
    - Stub di-isolasi: file `profile-api.ts` berisi hanya `changePassword` stub — `getMe` tidak dideklarasikan di sini (pakai `useSession`/`authApi.me`).

## 11. Assert manual (tanpa runner test)

- Login sebagai user apapun → klik "Pengaturan" di dropdown sidebar footer → URL jadi `/profile`, breadcrumb "Dashboard › Profile". Card `ProfileCard` langsung render dengan `fullName`/`email`/`status`/`role.name` (atau "Tanpa role") dan daftar `permissions` (badge) — **tanpa loading flash kosong** (placeholderData dari `useAuth().user`).
- Buka DevTools → Application → Local Storage → `auth.user` ada dan valid (object dengan `permissions: string[]`); kartu permission di halaman cocok dengan isi localStorage.
- Section "Ganti Password" tampil form (current/new/confirm) + tombol Simpan. Klik Simpan → mutation terpanggil (dari container `profile.tsx`, bukan dari card) → reject (stub) → banner "Fitur ganti password belum tersedia ..." tampil di atas form + toast `changePasswordFailed` muncul; **tidak ada error di console** (Promise rejection di-handle dengan benar). **Tidak ada** AlertDialog konfirmasi — submit langsung.
- Hapus token di DevTools (`localStorage.removeItem('auth.token')`) → refresh `/profile` → `useSession` 401 → `lib/api-client.ts` alur `expireSession()` redirect ke `/login` (path existing, tanpa toast sukses).
- 500 simulasi (mis. matikan backend) → card menampilkan banner "Gagal memuat profil. Silakan coba lagi." dengan Retry (tombol `useSession.refetch()`).
- `pnpm lint` + `pnpm tsc --noEmit` bersih. Tidak ada `any` di boundary API. Tidak ada edit manual `src/components/ui/`.

---

**File**: `frontend/docs/module/profile.md`
**Ringkasan isi (5 baris)**:

1. Halaman `/profile` (self) read-only + form ganti password stub, nested di `DashboardLayout`, LOGIN-only tanpa permission gate.
2. Pakai `useSession` existing (`['auth','me']`) untuk data — YAGNI: tidak tambah `useMe` hook baru. `useChangePassword` hook di `features/profile/hooks/use-change-password.ts` (sesuai AGENTS.md). File: `features/profile/{types.ts, api/profile-api.ts, hooks/use-change-password.ts, components/{profile-card, change-password-card}.tsx}`. Submit langsung → mutation (tanpa AlertDialog konfirmasi).
3. Backend saat ini **tidak punya** `change-password`/`me-update`/`timestamps` — dicatat sebagai TODO backend; mutation FE di-stub `Promise.reject` + banner `changePasswordNotAvailable`; **larang** pakai `PATCH /users/:id` untuk self.
4. SidebarUser "Pengaturan" → `navigate('/profile')`; breadcrumb dinamis tambah segmen Profile; tanpa menu sidebar tambahan (YAGNI).
5. i18n keys `profile:*` (id/en), toast via `@/lib/toast`, error 422 per-field via `mapApiFieldErrors`, komponen presentational + `cn()`; lint + tsc bersih sebagai verifikasi.