# Halaman Login & Register — Rencana Desain & Implementasi

Dokumen ini mencatat rencana desain/implementasi halaman **Login** dan **Register** pada frontend React, termasuk mekanisme **auto-refresh token**.

## 1. Tujuan & Ruang Lingkup

- Mendesain halaman Login & Register untuk frontend.
- Mendefinisikan struktur fitur auth, routing, penyimpanan token, serta penanganan error.
- Backend auth sudah tersedia (`backend/docs/modules/auth.md`) — kontrak API di bawah adalah kontrak final.

## 2. Routing

- Routes didefinisikan di `src/app/routes/` (React Router, `createBrowserRouter`).
- `/login` dan `/register` bersifat **public**.
- Halaman app (protected) di-guard: redirect ke `/login` bila tidak ada token.
- Struktur fitur auth di `src/features/auth/`:
  - `api/authApi.ts` — fungsi fetch endpoint login/register.
  - `hooks/` — `useLogin`, `useRegister` (TanStack Query mutation).
  - `components/` — `LoginForm`, `RegisterForm`.
  - `types.ts` — type payload/response auth.
- `AuthProvider` dipasang di `src/app/providers.tsx` untuk memegang state token + user.

## 3. Kontrak API (Final)

Kontrak final sesuai `backend/docs/modules/auth.md`. Prefix global `/api/v1`.

| Method | Path | Akses | Response | Error |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | PUBLIC | 201 data user (tanpa password_hash) | 409 duplikat, 422 |
| POST | `/auth/login` | PUBLIC | 200 `{ data: { accessToken, refreshToken, user }, message }` | 401 credential salah, 422 |
| POST | `/auth/refresh` | PUBLIC (body `refreshToken`) | 200 `{ data: { accessToken, refreshToken }, message }` — **rotasi** (token lama direvoke, token baru terbit) | 401 invalid/expired/reuse, 422 |
| POST | `/auth/logout` | LOGIN (Bearer) + body `{ refreshToken }` | 200 `{ data: null, message }` | 401 |
| GET | `/auth/me` | LOGIN | 200 data user+role+permissions | 401 |

Envelope sukses: `{ "data": { ... }, "message": "..." }`. Envelope error: `{ statusCode, message, errors }`.

### Catatan refresh (rotasi + reuse detection)

- Setiap sukses refresh (200) **mencabut** token lama dan menerbitkan token baru — token lama yang dipakai lagi setelah di-revoke memicu **reuse detection** → 401 + seluruh family refresh token user direvoke.
- Konsekuensi: klien **tidak boleh** memakai refresh token lama lebih dari sekali; refresh paralel dengan token yang sama berbahaya → serialized di `lib/api-client.ts` (seksi 7): single-flight intra-tab + lock lintas-tab via Web Locks API.

## 4. Alur Login

`LoginForm` (react-hook-form + zod) → submit → `useLogin` mutation → sukses:
1. `storeAuth(auth)` — simpan access+refresh+placeholder `SessionUser{role:null,permissions:[]}` (backend `/auth/login` tidak mengembalikan permissions).
2. `await hydrateSession()` — `GET /auth/me` via `authApi.me` dengan token baru, timpa `localStorage['auth.user']` + state sebelum navigate (fix gate `RequirePermission` users→`user:read`, roles→`role:read` yang sebelumnya selalu tolak sampai reload).
3. `navigate('/', { replace: true })` — route `/` (dashboard) = LOGIN-only via `ProtectedRoute` (tanpa kode permission).

Assert manual (tanpa runner test):
- Login sebagai admin → `localStorage['auth.user']` wajib memuat `permissions: string[]` non-kosong tanpa reload.
- Langsung buka `/users` dan `/roles` setelah login → tidak mental ke `/403`.
- Injeksi devtools (`localStorage['auth.user']` dengan `permissions: [123]` / `role: "admin"`) → `readStoredUser` menolak (key dihapus, status `unauthenticated`).
- `<RequirePermission>` tanpa `code`/`anyOf` atau `canAny([])` → deny (`false`) + `console.warn`.

## 5. Alur Register

`RegisterForm` → submit → `useRegister` mutation. Pasca sukses: auto-login **atau** redirect ke `/login`.

## 6. Penyimpanan Token & Status Sesi

- Token disimpan di `localStorage` (key: `auth.token`, `auth.refreshToken`, `auth.user`, `auth.refreshedAt`).
- `AuthProvider` expose: `user: SessionUser | null`, `status: 'loading' | 'authenticated' | 'unauthenticated'`, `isAuthenticated` (= `status === 'authenticated'`), `login`, `logout`.
- `status` reaktif via `useState` (bukan baca `localStorage` di `useMemo`) sehingga `ProtectedRoute`/`GuestRoute` dan query bereaksi tanpa reload.
- Saat mount (`AuthProvider`):
  - Tanpa token → langsung `unauthenticated`.
  - Token ada dan `isTokenExpired(token)` → silent refresh proaktif via `fetch` langsung `POST /api/v1/auth/refresh`, lalu verifikasi `GET /auth/me`. Sukses → `authenticated` + simpan user; 401 → `clearSessionStorage()` + `unauthenticated`.
  - Token ada dan belum expired → langsung verifikasi `GET /auth/me` untuk konfirmasi sesi.
- `login(auth)` menyimpan access+refresh+user (dipetakan ke `SessionUser`) dan menghapus penanda `auth.refreshedAt` yang stale via `clearRefreshMarker()`, lalu set `authenticated`.
- `logout()` = `clearSessionStorage()` + `setUser(null)` + `status unauthenticated` + `queryClient.clear()` + dispatch event `auth:expired` (disinkron ke hook `useLogout`).
- Sinkron multi-tab: listener `window 'storage'` (perubahan `auth.*` di tab lain → adopsi/hapus sesi) + listener custom `window 'auth:expired'` (dispatched oleh `clearSessionStorage()` di `lib/api-client.ts`).
- Helper sesi di `lib/api-client.ts` (tanpa import dari `features/auth/` agar tidak circular):
  - `isTokenExpired(token, skewSec=60)` — decode payload JWT base64url, `true` bila tidak bisa decode / tanpa `exp` / `exp <= now + skew`.
  - `clearSessionStorage()` — hapus 4 key + dispatch `auth:expired`.
  - `clearRefreshMarker()` — hapus `auth.refreshedAt` saja (dipakai `login`).
  - `expireSession()` memakai `clearSessionStorage()` lalu redirect `/login`.
- Sesi terverifikasi via hook `useSession` (`features/auth/hooks/useSession.ts`): `useQuery` key `['auth', 'me']`, `queryFn: me`, `staleTime: 60s`, `enabled` hanya bila `authenticated` (atau ada token saat belum `unauthenticated`), `retry` custom anti double-refresh (401 → `false`).
- Logout via hook `useLogout` (`features/auth/hooks/useLogout.ts`): `useMutation` `POST /auth/logout` best-effort — baca `refreshToken` dari `localStorage` sebelum clear, `onSettled` tetap `clear storage + queryClient.clear() + navigate('/login', {replace:true})` walau 401/network error.

## 7. Auto-Refresh Token

Mekanisme silent refresh dipusatkan di `src/lib/api-client.ts` (satu-satunya jalur request API).

Alur pada setiap request `doFetch`:

1. Request biasa dengan `Authorization: Bearer <accessToken>` (token dibaca terbaru dari localStorage pada saat fetch — retry otomatis memakai token baru).
2. Status **401** (dan path **bukan** `/auth/login` dan `/auth/refresh`):
   - Panggil `refreshTokens()` — silent refresh via `POST /auth/refresh` (tanpa Authorization header).
   - **Serialisasi refresh**: single-flight intra-tab (satu promise dibagikan ke semua caller bersamaan) + serialisasi lintas-tab via **Web Locks API** (`navigator.locks`, lock `auth:refresh` mode exclusive). Tab yang kedapatan sudah di-refresh tab lain (penanda `auth.refreshedAt`) langsung skip POST. Bila `navigator.locks` tidak didukung (browser lama) → fallback eksekusi tanpa lock (tetap single-flight per-tab, risiko refresh paralel antar-tab hanya bila browser tak punya Web Locks).
   - **Sukses** → simpan access+refresh baru ke localStorage, set penanda `auth.refreshedAt`, **retry request satu kali** dengan token baru. Retry gagal → throw error parsed.
    - **Invalid (401 server saat refresh)** → token benar-benar ditolak backend (expired / revoked / reuse). Backend sudah me-revoke seluruh family refresh token user → `expireSession()`: hapus `auth.token`, `auth.refreshToken`, `auth.user`, `auth.refreshedAt` + dispatch `auth:expired` + redirect ke `/login`, lalu throw error original (komponen tetap mendapat error). Listener `AuthProvider` (`storage` + `auth:expired`) mengubah `status` reaktif menjadi `unauthenticated` sehingga router/query sinkron tanpa reload manual.
   - **Error lain (network drop, 5xx saat refresh)** → throw error original **tanpa** `expireSession()`/redirect — koneksi turun bukan berarti refresh token invalid, session tidak dibuang.
   - **Reuse detection**: memakai refresh token yang sudah revoked (mis. refresh paralel dengan token sama yang lolos serialization) memicu 401 reuse → backend me-revoke **seluruh family** refresh token user. Itu sebabnya serialisasi lintas-tab wajib.
3. `401 /auth/login` = credential salah — **tidak** memicu refresh/redirect.
   `401 /auth/refresh` ditangani internal oleh `refreshTokens()` — **tidak** memicu refresh/redirect.
4. Status selain 401: perilaku tidak berubah.

Constraint: `lib/api-client.ts` **tidak boleh** import dari `features/auth/` (circular import) — refresh dipanggil dengan fetch langsung. Arah yang diizinkan: `features/auth/` **boleh** import dari `lib/` (`isTokenExpired`, `clearSessionStorage`, `queryClient`). `AuthProvider` memakai `fetch` langsung untuk silent-refresh proaktif (bukan via `authApi`) agar tidak bergantung pada instance query dan tetap single-flight via Web Locks + penanda `auth.refreshedAt`.

### Anti double-refresh (reuse detection)

- Refresh memakai token lama lebih dari sekali memicu reuse detection backend → 401 + revoke seluruh family. Karena itu refresh diserialisasi: single-flight intra-tab (`refreshPromise` di `api-client`) + lock lintas-tab `auth:refresh` (Web Locks API) + cek `auth.refreshedAt > requestTs` untuk skip bila tab lain sudah refresh.
- `AuthProvider` init memakai pola yang sama (lock `auth:refresh` + cek `refreshedAt`) sebelum `POST /auth/refresh`, sehingga mount paralel antar-tab tidak mengirim refresh ganda.
- Retry TanStack Query tidak boleh me-retry 401: `lib/query-client.ts` memakai fungsi `retry: (failureCount, error) => statusCode===401 ? false : failureCount<1` (import `ApiError` type-only agar tidak circular runtime), dan `useSession` memakai fungsi retry yang sama. Tanpa ini, query yang 401 akan di-retry dan tiap retry 401 di `api-client` memicu `refreshTokens()` → refresh paralel dengan token sama → reuse.

## 8. Error Handling

- Reuse `ApiError` dari `@/lib/api-client` (normalisasi `{ statusCode, message, errors }`) + helper `isValidationError(err)` (= status 422).
- `422` → `useEffect` map `mapApiFieldErrors(err)` → `form.setError` per-field + `<FormMessage/>` kosong tiap field; **tanpa toast** (`if (isValidationError(err)) return;`), **tanpa banner**, dialog/halaman tetap di form.
- Non-422 (`401` credential salah / sesi kedaluwarsa, 409, 500) → banner global di atas form + `toastError(getApiErrorMessage(...))` bila dari mutation.
- Referensi: bagian **API Integration** + **Form & Validasi** di `AGENTS.md`.

## 9. Konvensi Form

- Wajib: **react-hook-form** + **zod** (standar shadcn/ui).
- Schema di dalam komponen, bungkus `useMemo(..., [t])`; pesan hanya dari `t('validation:*')`; field string `trim/max` mirror DTO backend.
- Validasi: email valid, password min length (mis. 8 karakter).
- Field errors ditampilkan via komponen `Form` shadcn/ui (`<FormMessage/>` kosong tiap field, tanpa children).

## 10. Reusable Component

Mengikuti `AGENTS.md` (Reusable Component):

- Komponen form bersifat **presentational**; data/props masuk via props, `onSubmit` di-inject.
- Tanpa fetch langsung di dalam komponen form.
- Logika query/mutation diletakkan di hook (`useLogin` / `useRegister`).

## 11. Catatan

- Backend auth sudah final (register, login, refresh rotasi, logout, me) — kontrak seksi 3 mengikuti `backend/docs/modules/auth.md` dan tidak lagi TODO.
- Refresh token berotasi: jangan abaikan/mis-handle token baru dari response 200 refresh (token lama langsung direvoke backend).