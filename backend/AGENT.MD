---
description: Aturan ringkas pengembangan monorepo NestJS (backend API + worker) — logika bisnis di libs/src, arsitektur Service-Repository, konvensi Prisma/Redis/auth internal. Detail lengkap di docs/RULES.md.
---

# AGENT.MD — Aturan Ringkas Monorepo NestJS

## Package Manager

- Wajib `pnpm` — larang `npm`/`yarn`.
- `pnpm-lock.yaml` di-commit. Jalankan semua script via `pnpm` (`pnpm install`, `pnpm run build`, `pnpm prisma:generate`, `pnpm start:app`).
- Port: API 3001 (`API_PORT`), worker 3002 (`WORKER_PORT`). Script: `pnpm run build` (build app+worker), `pnpm run dev` (dev app+worker paralel).

## Monorepo & Scope

- Monorepo NestJS mode CLI: `nest-cli.json` dengan `monorepo: true`.
- Project:
  - `apps/app` — backend API utama.
  - `apps/worker` — worker API.
  - `libs/` — shared library, source di `libs/src/`.
- Logika bisnis + shared code HANYA di `libs/src`.
- Struktur `libs/src`: `core/`, `common/`, `integrations/`, `modules/`, `events/`, `commands/`.
- Controller TIDAK di `libs` — controller di setiap service: `apps/*/src/controllers/`.

## Arsitektur

- Pattern Service-Repository: `Controller → Service → Repository → Prisma`.
- Repository satu-satunya tempat query Prisma.
- Controller tipis — delegasi ke service di `libs`.

## Response & Error

- Sukses: `{ data, message }`.
- Error: `{ statusCode, message, errors }`.
- Semua error wajib Exception class jelas (BadRequest, NotFound, Conflict, dll).
- LARANG `throw new Error`.

## Validasi (detail: RULES Bab 7)

- `ValidationPipe` (whitelist + forbidNonWhitelisted + transform, 422) wajib di **app + worker**.
- Filter 422 kirim `{ field: property, message }` per-field; DTO strict (`@Transform` trim + `@MaxLength` + `@IsUUID`/`ArrayMinSize`); `ParseUUIDPipe` di semua `@Param('id')`.
- Aturan wajib mirror FE-BE; modul baru catat tabel validasi + contoh 422 di `docs/modules/<nama>.md`.

## Prisma

- `id` setiap tabel wajib UUID: `@id @default(uuid())` (jangan `cuid()`).
- Setiap relasi wajib FK eksplisit ke tabel target: kolom `<target>Id` + `@relation(fields: [...], references: [id])` — larang relasi tanpa kolom FK jelas.
- Relasi 1-to-many yang membutuhkan cascade delete wajib deklarasikan `onDelete: Cascade` eksplisit di sisi FK.
- Gunakan `select` kolom sesuai kebutuhan.
- Multi-tabel pakai transaksi `$transaction`.
- Map error Prisma (mis. P2002) ke Exception domain.

## Redis

- Redis cache via `libs/src/core/redis` wrapper (`cache.service.ts`).

## Auth Antar-Service

- Komunikasi antar-service (api ↔ worker) diamankan shared secret env + `InternalAuthGuard`.

## Auth & Authorization (detail: RULES Bab 21)

- Global guard: `JwtAuthGuard` lalu `PermissionsGuard` via `APP_GUARD` — semua endpoint terkunci default.
- Decorator wajib: setiap endpoint pasang `@Public()` | `@Permissions(...)` | LOGIN-only (hanya `auth/logout`, `auth/me`).
- Deny-by-default: tanpa metadata + tanpa user → `403` + `Logger.warn` (bug dekorator lupa).
- `401` = JWT invalid/expired (auth), `403` = JWT valid tapi permission kurang.
- Rujuk `docs/RULES.md` Bab 21 + `docs/modules/rbac.md` §6/§8 untuk daftar PUBLIC/LOGIN & tabel permission.
- Seed RBAC tunggal di `libs/prisma/seed.ts` (`DEFAULT_PERMISSIONS`/`DEFAULT_ROLES` + user admin dari env): wajib `upsert` by unique key dalam satu `$transaction` (`pnpm prisma:seed`).
- Relasi role→permission ADDITIVE via `rolePermission.upsert` — larang `deleteMany`/hapus relasi via seeder; password admin selalu di-reset dari env (argon2id) tiap re-seed. Rujuk RULES Bab 22 + `rbac.md` §7.

## List API (Pagination & Filter)

- Semua list endpoint default pagination: `{ data: [...], meta: { page, limit, total }, message }`.
- `limit` default `20`, max `100` (clamp); `page` bebas.
- Filter seragam `filter[field]=value` (operator: eq, ne, in, like, gt, gte, lt, lte).
- Sort default `createdAt desc` (`sortBy`/`sortOrder`). Whitelist field + enum invalid → 422.

## List CRUD: Search & Sort (wajib semua menu)

- Setiap list CRUD wajib dukung **`search`** global (server-side): `?search=` di-OR `like insensitive` ke `*_SEARCHABLE_FIELDS` per modul (User: fullName+email; Role: name+description; Permission: code+description). Trim; kosong/<2 char diabaikan (bukan error); >100 char → 422. Helper: `buildSearch` + `combineWhere` (AND dengan filter).
- Setiap kolom yang **ditampilkan** di tabel FE wajib **sortable** via `sortBy/sortOrder`: whitelist `*_SORT_FIELDS` per modul (User: fullName,email,status,roleName,createdAt,updatedAt; Role: name,description,createdAt,updatedAt; Permission: code,description,createdAt,updatedAt). Kolom relasi via `*_SORT_MAP` + helper `buildOrderBy` (mis. `roleName → role.name`). Tak dikenal → 422; sensitif (passwordHash) dilarang masuk whitelist.
- Modul baru wajib deklarasikan `*_FILTER_FIELDS`, `*_SEARCHABLE_FIELDS`, `*_SORT_FIELDS` (+`*_SORT_MAP` bila relasi) dan catat + contoh query di `docs/modules/<nama>.md`.

## Penanganan Waktu (UTC)

- Simpan `DateTime`/`timestamptz` UTC (`createdAt @default(now())`, `updatedAt @updatedAt`); kirim ISO `Z` (`toISOString()`).
- Terima ISO 8601 (`@IsISO8601()` atau `@Type(() => Date) @IsDate()` + `transform: true`); format lokal ambigu → 422.
- Filter tanggal via `*_DATE_FIELDS` + koersi `parseDateInput` (`gt/gte/lt/lte/eq` → `Date`, invalid → 422, `like` ditolak).
- Larang konstruksi rawan-TZ: `new Date(y,m,d)`, parse `toLocaleString`, aritmetika string lokal; pakai `new Date()` / `Date.now()` (epoch, UTC).

---

Rujuk `docs/RULES.md` untuk detail lengkap.
