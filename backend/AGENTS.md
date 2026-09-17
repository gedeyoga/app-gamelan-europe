---
description: Aturan ringkas pengembangan backend NestJS monorepo — Prisma, class-validator, RBAC.
---

# AGENTS.md — Aturan Ringkas Backend NestJS

## Stack & Scope

- Stack: NestJS monorepo (`nest-cli.json` `monorepo: true`), Prisma, class-validator/class-transformer, `@nestjs/mapped-types`, Joi env, pnpm.
- Batas: kode & logika bisnis di `backend/`. **Larang** menyentuh `frontend/`.
- Package manager wajib **pnpm** — larang `npm install`/`yarn`. Tambah dep via `pnpm add`/`pnpm add -D`.

## Wajib Baca Docs Sebelum Edit

Sebelum edit file apa pun, baca:

1. `backend/docs/RULES.md` — aturan monorepo, service-repository, response envelope, error mapping, validation, paginasi, RBAC, dll.
2. `backend/docs/SCHEMA.md` (jika ada) — overview entity & relasi.
3. `backend/docs/modules/<domain>.md` — spec domain yang akan diedit (contoh: `role.md`, `permission.md`, `user.md`, `rbac.md`, `auth.md`).
4. File existing di area yang akan diedit — pahami pattern sebelum menambah.

> Skip rule di atas → diff biasanya melawan konvensi. Pola ada di existing code; tiru, jangan re-invent.

## Folder Structure

```
backend/
├── nest-cli.json
├── apps/
│   ├── app/                  # API utama (port 3001)
│   └── worker/               # worker (port 3002)
└── libs/
    ├── prisma/
    │   ├── schema.prisma     # single source of truth entity
    │   └── seed.ts           # seed default (idempotent)
    └── src/
        ├── core/             # infrastruktur: database, redis, auth, config
        ├── common/           # lintas-potong: guards, filters, interceptors, dto/utils
        ├── integrations/     # klien pihak ketiga
        ├── modules/          # service+repository+dto+entities per domain
        ├── events/           # emit/listener
        └── commands/         # CLI/job handler
```

Decision tree penempatan (RULES §2):

- Service + repository + dto + entities → `modules/<domain>/`.
- HTTP endpoint → `apps/*/src/controllers/` (controller **tidak** di `libs`).
- Guard/filter/interceptor global → `common/`.
- DB/Redis/config → `core/`.
- Klien eksternal → `integrations/`.

## Pola Wajib

- **Service-Repository**: `Controller → Service → Repository → Prisma`. Repository satu-satunya tempat query Prisma; service tidak import `@prisma/client` kecuali untuk type Prisma input/where/orderBy.
- **Entity payload**: satu `select` + `Prisma.GetPayload` per view (lihat `modules/<domain>/entities/<domain>.entity.ts`). Jangan ulangi `Prisma.GetPayload` inline di banyak tempat.
- **DTO per endpoint**: `class-validator` + `class-transformer`; string wajib `Transform(trim)`; `@Param('id')` selalu `ParseUUIDPipe`.
- **Response envelope**: sukses `{ data, message }`; list paginated `{ data, message, meta }`; error `{ statusCode, message, errors }`.
- **Error mapping**: `P2002` → `ConflictException` (atau `UnprocessableEntityException` per domain); 422 validasi per-field; 401/403/404 sesuai (RULES §9/§13).
- **Pattern RBAC**: lihat `modules/permission/` sebagai referensi. `@Permissions('resource:action')` deny-by-default; `@Public()` untuk endpoint publik; LOGIN-only tanpa dekorator khusus untuk `/auth/logout` & `/auth/me`.
- **Permission code**: lowercase `resource:action`, mis. `user:read` (lihat `rbac.md` §4).

## Naming

- File: `kebab-case.ts` (`create-role.dto.ts`, `role.repository.ts`).
- Class: `PascalCase` (`RoleRepository`, `CreateRoleDto`).
- Service method: `create/update/remove/findOne/list/findById` (lowercase verb).
- Folder domain: singular (`role/`, `user/`, `permission/`).
- Konstanta filter/sort fields: `ROLE_FILTER_FIELDS`, `ROLE_SORT_FIELDS`, dll — di-export dari service agar bisa di-import FE/validasi sort.

## Verifikasi

Setelah edit:

- `pnpm tsc --noEmit` — typecheck (wajib pass sebelum commit).
- `pnpm lint` — ESLint backend.
- `pnpm prisma:generate` — bila `schema.prisma` berubah (auto via hook).
- `pnpm run build` — build app+worker sebelum merge/PR.
- `pnpm prisma:seed` — test seed bila entity/relasi berubah (idempoten).