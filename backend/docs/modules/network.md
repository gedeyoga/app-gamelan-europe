# Module: Network

Menu: [rbac.md](./rbac.md) (master) · [user.md](./user.md)

> **STATUS: DIIMPLEMENTASIKAN (backend).** CRUD `Network` tersedia. Domain ini sebelumnya bernama `Organization` (rename kode/API **dan DB**: tabel `networks`, kolom `network_id`; migration `20260929150000_rename_organization_to_network`). Nama lama hanya tersisa di folder migration historis (lihat [§2](#2-model-prisma)). Kolom `city` di-rename menjadi `state` (migration `*_rename_organization_city_to_state`), nilainya diisi dari tabel `states`. Kolom `content` (rich HTML, nullable) ditambahkan via migration `20260927150000_add_organization_content`; kolom `website`/`contact`/`social_media` ikut di migration `20260929150000_rename_organization_to_network`. Fitur row-level scoping yang memakainya → [rbac.md §10 Row-Level Scoping](./rbac.md#10-row-level-scoping).
>
> **RBAC ikut direname (v2).** Kode permission sekarang `network:create|read|update|delete`; role bawaan `organization` **dihapus** dari seed (`LEGACY_ROLE_NAMES`, lihat [rbac.md §7](./rbac.md#7-seed-default)).

---

## 1. Deskripsi & Lokasi

Modul **`network`** mengelola `Network` (jaringan/organisasi/lembaga). Relasi: `User.networkId → Network.id` (1 : N, nullable), `Event.networkId → Network.id` (1 : N, nullable; event.md §2 — network penyelenggara event). Network dipakai sebagai batas **row-level scoping**: user yang punya `networkId` **dan** permission tulis resource hanya boleh membaca/menulis konten milik anggota network-nya ([rbac.md §10](./rbac.md#10-row-level-scoping)). Admin masih bisa menetapkan `networkId` user lewat `POST /users` ([user.md §7](./user.md#7-endpoint)).

Pengelolaan network sendiri **admin-only**: endpoint butuh permission `network:create/read/update/delete` — role bawaan `member`/`author` tidak memilikinya.

Lokasi kode:

```
libs/src/modules/network/
├── network.repository.ts
├── network.service.ts
├── network.module.ts
├── dto/
│   ├── create-network.dto.ts
│   ├── update-network.dto.ts
│   └── list-networks-query.dto.ts
└── entities/
    └── network.entity.ts

apps/app/src/controllers/networks.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

Alur baku `Controller → Service → Repository → Prisma`; repository satu-satunya tempat query Prisma. Modul didaftarkan di `libs/src/libs.module.ts` (imports + exports) dan controller di `apps/app/src/app.module.ts`.

### Migration rename `organization` → `network`

Migration `20260929150000_rename_organization_to_network` mengerjakan seluruh rename dalam satu file: `ALTER TABLE "organizations" RENAME TO "networks"`, rename PK (`organizations_pkey` → `networks_pkey`), `RENAME COLUMN "organization_id" TO "network_id"` pada `users`/`billings`/`events` + rename index (`*_organization_id_idx` → `*_network_id_idx`) & FK constraint (`*_organization_id_fkey` → `*_network_id_fkey`), `ADD COLUMN "website"/"contact"/"social_media"` pada `networks`, dan `UPDATE "permissions" SET "code" = 'network:*' WHERE "code" = 'organization:*'` (baris data; `role_permissions`/`api_key_permissions` mereferensikan `permission_id` → tidak perlu diubah).

Migration penambah kolom v1 (`20260929120000_add_network_fields`) **digabung** ke migration ini (belum pernah di-apply ke DB mana pun) dan foldernya dihapus.

### Migration historis (nama lama dipertahankan)

Kolom `city` → `state` dilakukan migration `20260924120000_rename_organization_city_to_state` (tabel saat itu masih `organizations`):

```sql
ALTER TABLE "organizations" RENAME COLUMN "city" TO "state";
```

Kolom `content` ditambahkan migration `20260927150000_add_organization_content` (tabel masih `organizations`):

```sql
ALTER TABLE "organizations" ADD COLUMN "content" TEXT;
```

Nama folder lama **tidak diubah** — sudah di-apply ke DB, mengubahnya akan merusak checksum `_prisma_migrations`. Jalankan `pnpm prisma:seed` untuk menambah permission `network:*` (lihat [rbac.md §7](./rbac.md#7-seed-default)).

---

## 2. Model Prisma

```prisma
model Network {
  id          String    @id @default(uuid())
  name        String
  state       String?
  country     String?
  address     String?
  content     String?   @db.Text
  website     String?
  contact     String?
  socialMedia Json?     @map("social_media")
  lat         Decimal?  @db.Decimal(10, 7)
  lng         Decimal?  @db.Decimal(10, 7)
  users       User[]
  billings    Billing[]
  events      Event[]
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
}
```

- Tabel DB = `networks` dicapai lewat `@@map("networks")` pada model `Network`. Relasi `User`/`Billing`/`Event` memakai `networkId` di kode **dan** kolom `network_id` di DB lewat `@map("network_id")`. Nama lama `organizations`/`organization_id` sudah di-rename migration `20260929150000_rename_organization_to_network`.
- `name` **tidak unik** → boleh ada nama network sama (tidak ada `P2002`). Implikasi: `findByNameInsensitive` (case-insensitive) bisa cocok ke lebih dari satu row → `findFirst` (ambil yang pertama); typo/varian nama membuat network duplikat (merge/dedupe = backlog).
- `events Event[]` — back-relation dari `Event.networkId` (nullable, `onDelete: SetNull`; event.md §2). Menghapus network tidak menghapus event, hanya melepas `networkId`.
- `content` `String?` (`@db.Text`) — rich HTML profil/deskripsi network, nullable. Disimpan **sudah disanitasi** (`sanitizeStoryContent`, [§5](#5-repository--service)); TIDAK di-resolve ke gambar/`Image` (beda dari story) — URL gambar di dalam HTML sudah absolut ke S3/CDN.
- `website`/`contact` `String?` nullable (bebas teks; URL/telepon disimpan apa adanya).
- `socialMedia` `Json?` (`@map("social_media")`) nullable — array `[{ platform, url }]`, maksimum **10** entri. `null` = belum diisi.
- `lat`/`lng` `Decimal(10, 7)` nullable; dikonversi ke `number | null` saat mapping (Decimal tidak bisa di-`JSON.stringify` dengan bentuk yang diinginkan FE).
- `User.networkId` dan `Billing.networkId` memakai `onDelete: SetNull` → menghapus network tidak menghapus user/billing, hanya melepas relasinya.

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4). Satu payload type, definisi di `entities/`.

```typescript
// libs/src/modules/network/entities/network.entity.ts
import { Prisma } from '@prisma/client';

export const networkSelect = {
  id: true,
  name: true,
  state: true,
  country: true,
  address: true,
  content: true,
  website: true,
  contact: true,
  socialMedia: true,
  lat: true,
  lng: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NetworkSelect;

export type NetworkPayload = Prisma.NetworkGetPayload<{ select: typeof networkSelect }>;

// Decimal → number | null (aman untuk rentang koordinat).
export type NetworkEntity = Omit<NetworkPayload, 'lat' | 'lng'> & {
  lat: number | null;
  lng: number | null;
};

export function mapNetwork(row: NetworkPayload): NetworkEntity {
  return {
    ...row,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
  };
}
```

Response API mengembalikan `lat`/`lng` sebagai `number | null` (bukan string Decimal), `content` sebagai `string | null` (rich HTML tersanitasi), `website`/`contact` sebagai `string | null`, dan `socialMedia` sebagai `[{ platform, url }] | null`. Tidak ada kolom sensitif.

---

## 4. DTO / Query List

Status validasi gagal = **422** (RULES bab 7). Kontrak 422: `{ statusCode: 422, message: 'Validation failed', errors: [{ field, message }] }`. Semua `@Param('id')` pakai `ParseUUIDPipe`.

```typescript
// libs/src/modules/network/dto/create-network.dto.ts
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class NetworkSocialMediaDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(50)
  platform: string;

  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(500)
  url: string;
}

export class CreateNetworkDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(100)
  state?: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(100)
  country?: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(500)
  address?: string;

  // Rich HTML; disanitasi server-side (`sanitizeStoryContent`) di create & update.
  @IsOptional() @IsString() @MaxLength(100000)
  content?: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(500)
  website?: string | null;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(200)
  contact?: string | null;

  // `null` eksplisit = kosongkan (update) → `Prisma.DbNull`. Max 10 entri.
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => NetworkSocialMediaDto)
  socialMedia?: NetworkSocialMediaDto[] | null;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  lat?: number;

  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  lng?: number;
}
```

```typescript
// libs/src/modules/network/dto/update-network.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateNetworkDto } from './create-network.dto';

export class UpdateNetworkDto extends PartialType(CreateNetworkDto) {}
```

```typescript
// libs/src/modules/network/dto/list-networks-query.dto.ts
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListNetworksQueryDto extends ListQueryDto {}
```

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `name` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` | 422 `{ field: 'name', message }` |
| `state` | trim opsional, `@IsString()`, `@MaxLength(100)` | 422 `{ field: 'state', message }` |
| `country` | trim opsional, `@IsString()`, `@MaxLength(100)` | 422 `{ field: 'country', message }` |
| `address` | trim opsional, `@IsString()`, `@MaxLength(500)` | 422 `{ field: 'address', message }` |
| `content` | opsional, `@IsString()`, `@MaxLength(100000)`; disanitasi server-side sebelum simpan | 422 `{ field: 'content', message }` |
| `website` | trim opsional, `@IsString()`, `@MaxLength(500)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'website', message }` |
| `contact` | trim opsional, `@IsString()`, `@MaxLength(200)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'contact', message }` |
| `socialMedia` | opsional, `@IsArray()`, `@ArrayMaxSize(10)`, `@ValidateNested({ each: true })` `NetworkSocialMediaDto`; nullable (`null` = kosongkan saat update) | 422 `{ field: 'socialMedia', message }` (atau `socialMedia.0.platform` dst.) |
| `socialMedia[].platform` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(50)` | 422 `{ field: 'socialMedia.0.platform', message }` |
| `socialMedia[].url` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(500)` | 422 `{ field: 'socialMedia.0.url', message }` |
| `lat` | opsional, `@IsNumber()`, `@Min(-90)`, `@Max(90)` | 422 `{ field: 'lat', message }` |
| `lng` | opsional, `@IsNumber()`, `@Min(-180)`, `@Max(180)` | 422 `{ field: 'lng', message }` |
| `:id` path | `ParseUUIDPipe` | 422/400 UUID invalid |

> `lat`/`lng` harus **number JSON** (`@IsNumber()`); kirim sebagai string → 422. `UpdateNetworkDto` (PartialType) membuat semua field opsional; `PATCH` dengan body kosong `{}` mengembalikan resource apa adanya (tanpa update).

```json
// POST /networks dengan lat di luar rentang
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "lat", "message": "lat must not be greater than 90" }]
}
```

### Konstanta list

`ListNetworksQueryDto` memakai `ListQueryDto` shared (RULES bab 19). Konstanta whitelist di-export dari `network.service.ts`:

| Konstanta | Nilai |
| --- | --- |
| `NETWORK_SEARCHABLE_FIELDS` | `['name', 'state', 'country', 'address', 'website', 'contact']` |
| `NETWORK_SORT_FIELDS` | `['name', 'state', 'country', 'address', 'website', 'contact', 'createdAt', 'updatedAt']` |
| `NETWORK_FILTER_FIELDS` | `['name', 'state', 'country', 'website', 'contact', 'createdAt', 'updatedAt']` |
| `NETWORK_DATE_FIELDS` | `['createdAt', 'updatedAt']` (ISO 8601; invalid → 422; `like` ditolak) |

- `filter[<field>]` di luar whitelist → 422; `sortBy` di luar whitelist → 422 (`assertAllowedSort`).
- `search` OR `like insensitive` ke field searchable; trim, kosong/<2 char diabaikan (`buildSearch`).
- `page` default 1, `limit` default 20 (clamp 100), `sortOrder` default `desc`, `sortBy` default `createdAt`.

---

## 5. Repository & Service

### Repository (`network.repository.ts`)

| Method | Fungsi |
| --- | --- |
| `findById(id)` | Detail; `select: networkSelect`; tidak ada → `NotFoundException('Network not found')`. |
| `existsById(id)` | `findUnique({ select: { id: true } })` → boolean (dipakai event service untuk cek `networkId`). |
| `findByNameInsensitive(name)` | `findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: networkSelect })`. Trim input sebelum panggil. `name` tidak unik → ambil row pertama. |
| `findMany({ where, skip, take, orderBy })` | List paginated (`$transaction`: `findMany` + `count`); map `mapNetwork`. |
| `create(data)` | Insert; `data` = `Prisma.NetworkCreateInput`. |
| `update(id, data)` | Pre-check `findUnique({ select: { id: true } })` → tidak ada = 404; lalu update. |
| `remove(id)` | Pre-check id → 404; lalu delete. Relasi user/billing `onDelete: SetNull` (tidak ikut terhapus). |

### Service (`network.service.ts`)

| Method | Fungsi |
| --- | --- |
| `list(query)` | `buildWhere` (filter + date) + `buildSearch` + `combineWhere` + `buildOrderBy`; delegasi ke repo. |
| `findOne(id)` | `repository.findById`. |
| `findOrCreateByName(name, { state?, country? })` | Find-or-create untuk submit event publik (`POST /event-submissions`): `findByNameInsensitive(name)` → bila ada kembalikan; bila tidak → `repository.create({ name, state: state ?? null, country: country ?? null })`. Dipanggil di dalam transaksi submit. `name` tidak unik → bisa duplikat (typo); dedupe/merge = backlog. |
| `create(dto)` | Petakan field DTO → `repository.create`. Bila `dto.content !== undefined` → simpan hasil `sanitizeStoryContent(dto.content)`. `website`/`contact` → `?? null`; `socialMedia` → `dto.socialMedia ?? undefined` (biarkan DB default NULL bila tidak dikirim). |
| `update(id, dto)` | Kumpulkan hanya field yang `!== undefined`; `content` disanitasi via `sanitizeStoryContent` bila dikirim; `website`/`contact` ditulis apa adanya (termasuk `null`); `socialMedia`: `null` → `Prisma.DbNull`, selain itu array `[{ platform, url }]` apa adanya; body kosong → kembalikan `findOne(id)` tanpa update. |
| `remove(id)` | `repository.remove`. |

> **Handling `socialMedia` (Json nullable).** Create: `dto.socialMedia ?? undefined` (tidak mengirim → kolom dibiarkan `NULL` default; tanpa sentinel). Update: hanya bila `dto.socialMedia !== undefined`; `null` → `Prisma.DbNull` (set kolom `NULL`), array → disimpan apa adanya. Array di-map ke plain `{ platform, url }` agar assignable ke `Prisma.InputJsonValue`.

> Tidak ada row-level scoping di modul ini — CRUD network murni admin-only lewat permission. Scoping berbasis `networkId` diterapkan di modul `post`/`event`/`user` (lihat [rbac.md §10](./rbac.md#10-row-level-scoping)).

> **Inter-module:** modul `event` (jalur submit publik) mengimpor `NetworkModule` dan memanggil `NetworkService.findOrCreateByName` saat submit — **bukan** query Prisma lintas modul. `NetworkModule` wajib meng-`exports` service/repository agar bisa di-inject (RULES bab 3/11).

---

## 6. Endpoint & Permission

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta: { page, limit, total }, message }`; error `{ statusCode, message, errors }`.

> Dekorator permission: `network:create|read|update|delete` (rename RBAC v2; role bawaan `organization` dihapus — [rbac.md §7](./rbac.md#7-seed-default)).

| Method | Path | Akses | Request | Response sukses | Error |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/networks` | PERMISSION `network:create` | body `CreateNetworkDto` | 201 `{ data: <network>, message }` | 422, 401/403 |
| GET | `/api/v1/networks` | PERMISSION `network:read` | query `ListNetworksQueryDto` | 200 `{ data: [network], meta, message }` | 422 sortBy/filter tak dikenal, 401/403 |
| GET | `/api/v1/networks/:id` | PERMISSION `network:read` | path `id` UUID | 200 `{ data: <network>, message }` | 404, 422 UUID invalid, 401/403 |
| PATCH | `/api/v1/networks/:id` | PERMISSION `network:update` | path `id`, body `UpdateNetworkDto` | 200 `{ data: <network>, message }` | 404, 422, 401/403 |
| DELETE | `/api/v1/networks/:id` | PERMISSION `network:delete` | path `id` UUID | 200 `{ data: <network>, message }` | 404, 422 UUID invalid, 401/403 |

### Contoh query

- `GET /api/v1/networks?page=1&limit=20&sortBy=name&sortOrder=asc`
- `GET /api/v1/networks?search=gamelan`
- `GET /api/v1/networks?filter[country]=Indonesia&filter[createdAt][gte]=2026-09-01T00:00:00Z`

### Contoh respons

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Gamelan Nusantara",
    "state": "Bali",
    "country": "Belanda",
    "address": "Kerkstraat 1",
    "content": "<p>Perhimpunan gamelan...</p>",
    "website": "https://gamelan-nusantara.org",
    "contact": "+31612345678",
    "socialMedia": [
      { "platform": "instagram", "url": "https://instagram.com/gamelannusantara" }
    ],
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
| `GET/PATCH/DELETE /networks/:id` | `NotFoundException` | 404 | network tidak ditemukan |
| `POST/PATCH /networks` | `UnprocessableEntityException` | 422 | validasi DTO |
| `GET /networks` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, tanggal non-ISO |
| semua | `UnauthorizedException` | 401 | JWT tidak ada / invalid / expired |
| semua | `ForbiddenException` | 403 | JWT valid tapi permission kurang (mis. role bawaan `member`/`author` tanpa `network:*`) |
| semua | `BadRequestException` | 400 | payload/query tidak dapat dipahami |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).

```json
// 404
{ "statusCode": 404, "message": "Network not found", "errors": [] }
```
