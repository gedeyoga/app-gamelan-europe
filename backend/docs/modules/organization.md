# Module: Organization

Menu: [rbac.md](./rbac.md) (master) · [user.md](./user.md)

> **STATUS: DIIMPLEMENTASIKAN (backend).** CRUD `Organization` tersedia. **Tanpa migration baru** — model `Organization` sudah ada sejak migration init repo; hanya entity/service/controller + 4 permission `organization:*` yang ditambahkan. Fitur row-level scoping yang memakainya → [rbac.md §10 Row-Level Scoping](./rbac.md#10-row-level-scoping).

---

## 1. Deskripsi & Lokasi

Modul **`organization`** mengelola `Organization` (organisasi/lembaga). Relasi: `User.organizationId → Organization.id` (1 : N, nullable). Organization dipakai sebagai batas **row-level scoping**: user ber-role `organization` hanya boleh membaca/menulis konten milik anggota organisasinya, dan saat membuat user dipaksa masuk organisasinya sendiri (lihat [rbac.md §10](./rbac.md#10-row-level-scoping) + [user.md §7](./user.md#7-endpoint)).

Pengelolaan organization sendiri **admin-only**: endpoint butuh permission `organization:create/read/update/delete` — role `organization`/`member` tidak memilikinya.

Lokasi kode:

```
libs/src/modules/organization/
├── organization.repository.ts
├── organization.service.ts
├── organization.module.ts
├── dto/
│   ├── create-organization.dto.ts
│   ├── update-organization.dto.ts
│   └── list-organizations-query.dto.ts
└── entities/
    └── organization.entity.ts

apps/app/src/controllers/organizations.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

Alur baku `Controller → Service → Repository → Prisma`; repository satu-satunya tempat query Prisma. Modul didaftarkan di `libs/src/libs.module.ts` (imports + exports) dan controller di `apps/app/src/app.module.ts`.

### Tidak ada migration baru

Model `Organization` sudah ada di `libs/prisma/schema.prisma` (dan tabel `organizations` sudah dibuat migration init repo). Iterasi ini **tidak** menambah/mengubah kolom → tidak ada migration. Jalankan `pnpm prisma:seed` untuk menambah 4 permission `organization:*` (lihat [rbac.md §7](./rbac.md#7-seed-default)).

---

## 2. Model Prisma

```prisma
model Organization {
  id        String    @id @default(uuid())
  name      String
  city      String?
  country   String?
  address   String?
  lat       Decimal?  @db.Decimal(10, 7)
  lng       Decimal?  @db.Decimal(10, 7)
  users     User[]
  billings  Billing[]
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  @@map("organizations")
}
```

- `name` **tidak unik** → boleh ada nama organisasi sama (tidak ada `P2002`).
- `lat`/`lng` `Decimal(10, 7)` nullable; dikonversi ke `number | null` saat mapping (Decimal tidak bisa di-`JSON.stringify` dengan bentuk yang diinginkan FE).
- `User.organizationId` dan `Billing.organizationId` memakai `onDelete: SetNull` → menghapus organization tidak menghapus user/billing, hanya melepas relasinya.

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4). Satu payload type, definisi di `entities/`.

```typescript
// libs/src/modules/organization/entities/organization.entity.ts
import { Prisma } from '@prisma/client';

export const organizationSelect = {
  id: true,
  name: true,
  city: true,
  country: true,
  address: true,
  lat: true,
  lng: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

export type OrganizationPayload = Prisma.OrganizationGetPayload<{ select: typeof organizationSelect }>;

// Decimal → number | null (aman untuk rentang koordinat).
export type OrganizationEntity = Omit<OrganizationPayload, 'lat' | 'lng'> & {
  lat: number | null;
  lng: number | null;
};

export function mapOrganization(row: OrganizationPayload): OrganizationEntity {
  return {
    ...row,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
  };
}
```

Response API mengembalikan `lat`/`lng` sebagai `number | null` (bukan string Decimal). Tidak ada kolom sensitif.

---

## 4. DTO / Query List

Status validasi gagal = **422** (RULES bab 7). Kontrak 422: `{ statusCode: 422, message: 'Validation failed', errors: [{ field, message }] }`. Semua `@Param('id')` pakai `ParseUUIDPipe`.

```typescript
// libs/src/modules/organization/dto/create-organization.dto.ts
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateOrganizationDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(100)
  country?: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(500)
  address?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  lat?: number;

  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  lng?: number;
}
```

```typescript
// libs/src/modules/organization/dto/update-organization.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
```

```typescript
// libs/src/modules/organization/dto/list-organizations-query.dto.ts
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListOrganizationsQueryDto extends ListQueryDto {}
```

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `name` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` | 422 `{ field: 'name', message }` |
| `city` | trim opsional, `@IsString()`, `@MaxLength(100)` | 422 `{ field: 'city', message }` |
| `country` | trim opsional, `@IsString()`, `@MaxLength(100)` | 422 `{ field: 'country', message }` |
| `address` | trim opsional, `@IsString()`, `@MaxLength(500)` | 422 `{ field: 'address', message }` |
| `lat` | opsional, `@IsNumber()`, `@Min(-90)`, `@Max(90)` | 422 `{ field: 'lat', message }` |
| `lng` | opsional, `@IsNumber()`, `@Min(-180)`, `@Max(180)` | 422 `{ field: 'lng', message }` |
| `:id` path | `ParseUUIDPipe` | 422/400 UUID invalid |

> `lat`/`lng` harus **number JSON** (`@IsNumber()`); kirim sebagai string → 422. `UpdateOrganizationDto` (PartialType) membuat semua field opsional; `PATCH` dengan body kosong `{}` mengembalikan resource apa adanya (tanpa update).

```json
// POST /organizations dengan lat di luar rentang
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "lat", "message": "lat must not be greater than 90" }]
}
```

### Konstanta list

`ListOrganizationsQueryDto` memakai `ListQueryDto` shared (RULES bab 19). Konstanta whitelist di-export dari `organization.service.ts`:

| Konstanta | Nilai |
| --- | --- |
| `ORGANIZATION_SEARCHABLE_FIELDS` | `['name', 'city', 'country', 'address']` |
| `ORGANIZATION_SORT_FIELDS` | `['name', 'city', 'country', 'address', 'createdAt', 'updatedAt']` |
| `ORGANIZATION_FILTER_FIELDS` | `['name', 'city', 'country', 'createdAt', 'updatedAt']` |
| `ORGANIZATION_DATE_FIELDS` | `['createdAt', 'updatedAt']` (ISO 8601; invalid → 422; `like` ditolak) |

- `filter[<field>]` di luar whitelist → 422; `sortBy` di luar whitelist → 422 (`assertAllowedSort`).
- `search` OR `like insensitive` ke field searchable; trim, kosong/<2 char diabaikan (`buildSearch`).
- `page` default 1, `limit` default 20 (clamp 100), `sortOrder` default `desc`, `sortBy` default `createdAt`.

---

## 5. Repository & Service

### Repository (`organization.repository.ts`)

| Method | Fungsi |
| --- | --- |
| `findById(id)` | Detail; `select: organizationSelect`; tidak ada → `NotFoundException('Organization not found')`. |
| `findMany({ where, skip, take, orderBy })` | List paginated (`$transaction`: `findMany` + `count`); map `mapOrganization`. |
| `create(data)` | Insert; `data` = `Prisma.OrganizationCreateInput`. |
| `update(id, data)` | Pre-check `findUnique({ select: { id: true } })` → tidak ada = 404; lalu update. |
| `remove(id)` | Pre-check id → 404; lalu delete. Relasi user/billing `onDelete: SetNull` (tidak ikut terhapus). |

### Service (`organization.service.ts`)

| Method | Fungsi |
| --- | --- |
| `list(query)` | `buildWhere` (filter + date) + `buildSearch` + `combineWhere` + `buildOrderBy`; delegasi ke repo. |
| `findOne(id)` | `repository.findById`. |
| `create(dto)` | Petakan field DTO → `repository.create`. |
| `update(id, dto)` | Kumpulkan hanya field yang `!== undefined`; body kosong → kembalikan `findOne(id)` tanpa update. |
| `remove(id)` | `repository.remove`. |

> Tidak ada row-level scoping di modul ini — CRUD organization murni admin-only lewat permission. Scoping berbasis `organizationId` diterapkan di modul `post`/`event`/`user` (lihat [rbac.md §10](./rbac.md#10-row-level-scoping)).

---

## 6. Endpoint & Permission

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta: { page, limit, total }, message }`; error `{ statusCode, message, errors }`.

| Method | Path | Akses | Request | Response sukses | Error |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/organizations` | PERMISSION `organization:create` | body `CreateOrganizationDto` | 201 `{ data: <organization>, message }` | 422, 401/403 |
| GET | `/api/v1/organizations` | PERMISSION `organization:read` | query `ListOrganizationsQueryDto` | 200 `{ data: [organization], meta, message }` | 422 sortBy/filter tak dikenal, 401/403 |
| GET | `/api/v1/organizations/:id` | PERMISSION `organization:read` | path `id` UUID | 200 `{ data: <organization>, message }` | 404, 422 UUID invalid, 401/403 |
| PATCH | `/api/v1/organizations/:id` | PERMISSION `organization:update` | path `id`, body `UpdateOrganizationDto` | 200 `{ data: <organization>, message }` | 404, 422, 401/403 |
| DELETE | `/api/v1/organizations/:id` | PERMISSION `organization:delete` | path `id` UUID | 200 `{ data: <organization>, message }` | 404, 422 UUID invalid, 401/403 |

### Contoh query

- `GET /api/v1/organizations?page=1&limit=20&sortBy=name&sortOrder=asc`
- `GET /api/v1/organizations?search=gamelan`
- `GET /api/v1/organizations?filter[country]=Indonesia&filter[createdAt][gte]=2026-09-01T00:00:00Z`

### Contoh respons

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Gamelan Nusantara",
    "city": "Amsterdam",
    "country": "Belanda",
    "address": "Kerkstraat 1",
    "lat": 52.3676,
    "lng": 4.9041,
    "createdAt": "2026-09-01T00:00:00.000Z",
    "updatedAt": "2026-09-10T10:00:00.000Z"
  },
  "message": "success"
}
```

---

## 7. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `GET/PATCH/DELETE /organizations/:id` | `NotFoundException` | 404 | organization tidak ditemukan |
| `POST/PATCH /organizations` | `UnprocessableEntityException` | 422 | validasi DTO |
| `GET /organizations` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, tanggal non-ISO |
| semua | `UnauthorizedException` | 401 | JWT tidak ada / invalid / expired |
| semua | `ForbiddenException` | 403 | JWT valid tapi permission kurang (mis. role `organization`/`member` tanpa `organization:*`) |
| semua | `BadRequestException` | 400 | payload/query tidak dapat dipahami |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).

```json
// 404
{ "statusCode": 404, "message": "Organization not found", "errors": [] }
```
