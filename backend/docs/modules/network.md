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
  embedUrl    String?   @map("embed_url")
  mapsUrl     String?   @map("maps_url")
  submitterFullName String? @map("submitter_full_name")
  submitterEmail    String? @map("submitter_email")
  submitterCountry  String? @map("submitter_country")
  submitterState    String? @map("submitter_state")
  users       User[]
  events      Event[]
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
}
```

- Tabel DB = `networks` dicapai lewat `@@map("networks")` pada model `Network`. Relasi `User`/`Event` memakai `networkId` di kode **dan** kolom `network_id` di DB lewat `@map("network_id")`. Nama lama `organizations`/`organization_id` sudah di-rename migration `20260929150000_rename_organization_to_network`.
- `name` **tidak unik** → boleh ada nama network sama (tidak ada `P2002`). Implikasi: `findByNameInsensitive` (case-insensitive) bisa cocok ke lebih dari satu row → `findFirst` (ambil yang pertama); typo/varian nama membuat network duplikat (merge/dedupe = backlog).
- `events Event[]` — back-relation dari `Event.networkId` (nullable, `onDelete: SetNull`; event.md §2). Menghapus network tidak menghapus event, hanya melepas `networkId`.
- `content` `String?` (`@db.Text`) — rich HTML profil/deskripsi network, nullable. Disimpan **sudah disanitasi** (`sanitizeStoryContent`, [§5](#5-repository--service)); TIDAK di-resolve ke gambar/`Image` (beda dari story) — URL gambar di dalam HTML sudah absolut ke S3/CDN.
- `website`/`contact` `String?` nullable (bebas teks; URL/telepon disimpan apa adanya).
- `socialMedia` `Json?` (`@map("social_media")`) nullable — array `[{ platform, url }]`, maksimum **10** entri. `null` = belum diisi.
- `mapsUrl` `String?` nullable (`@map("maps_url")`) — link Google Maps opsional. Divalidasi `@IsUrl()` (URL invalid → 422). Bila diisi, server **me-resolve** link (mengikuti shortlink) menjadi `lat`/`lng` + `embedUrl`; link yang tidak dapat di-resolve → 422 `mapsUrl`. `null` eksplisit = kosongkan saat update (koordinat lama dipertahankan).
- `embedUrl` `String?` nullable (`@map("embed_url")`) — URL embed Google Maps keyless yang dibuat server dari koordinat hasil resolve (`https://www.google.com/maps?q=<lat>,<lng>&z=15&hl=en&output=embed`). Migration `20261010120000_network_embed_url` menambah kolom ini, mem-backfill `lat`/`lng` dari `mapsUrl` pada row lama (pin `!3d!4d` → viewport `@lat,lng`), lalu mem-backfill `embed_url` dari koordinat.
- `lat`/`lng` `Decimal(10, 7)` nullable; dikonversi ke `number | null` saat mapping (Decimal tidak bisa di-`JSON.stringify` dengan bentuk yang diinginkan FE). Diisi server-side dari `mapsUrl` bila ada (**menimpa** `lat`/`lng` klien); tanpa `mapsUrl` nilainya dari `lat`/`lng` klien (opsional).
- `User.networkId` memakai `onDelete: SetNull` → menghapus network tidak menghapus user, hanya melepas relasinya.
- `submitterFullName`/`submitterEmail`/`submitterCountry`/`submitterState` `String?` nullable (`@map("submitter_*")`) — identitas pengirim usulan publik, **disimpan di row `networks`** (tidak ada `User` yang dibuat). `null` untuk network buatan admin/terdaftar. Migration `20261018120000_network_submitter_fields`. `submitterCountry`/`submitterState` berisi **nama** hasil resolve `countryId`/`stateId` submitter; submitter yang sama boleh mengirim berkali-kali (tidak ada dedupe/unique email).
- `createdBy` (`@map("created_by")`, relasi `creator`, `onDelete: SetNull`) tetap dipakai network buatan admin/terdaftar; submit publik menulis `createdBy: null`.

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
  embedUrl: true,
  countryId: true,
  stateId: true,
  submitterFullName: true,
  submitterEmail: true,
  submitterCountry: true,
  submitterState: true,
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
import { ArrayMaxSize, IsArray, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { NetworkOrganisationType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// Whitespace-only → null (bukan `''`) agar kolom nullable benar-benar kosong.
const trimNullable = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
const trimNullableLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() || null : value;

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

  // Link Google Maps; server me-resolve ke lat/lng (invalid/unresolvable → 422); `null` eksplisit = kosongkan (update).
  @IsOptional() @Transform(trim) @IsUrl({}, { message: 'mapsUrl must be a URL' }) @MaxLength(2048)
  mapsUrl?: string | null;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(200)
  contact?: string | null;

  // `null` eksplisit = kosongkan (update).
  @IsOptional() @IsEnum(NetworkOrganisationType)
  organisationType?: NetworkOrganisationType | null;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(200)
  ledBy?: string | null;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(100)
  activityType?: string | null;

  // Identitas pengirim usulan publik (kolom `submitter_*`); `null` eksplisit = kosongkan (update).
  @Transform(trimNullable) @IsOptional() @IsString() @MaxLength(200)
  submitterFullName?: string | null;

  @Transform(trimNullableLower) @IsOptional() @IsEmail() @MaxLength(200)
  submitterEmail?: string | null;

  @Transform(trimNullable) @IsOptional() @IsString() @MaxLength(100)
  submitterCountry?: string | null;

  @Transform(trimNullable) @IsOptional() @IsString() @MaxLength(100)
  submitterState?: string | null;

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
| `mapsUrl` | trim opsional, `@IsUrl()`, `@MaxLength(2048)`, nullable (`null` = kosongkan saat update); URL invalid → 422; server me-resolve ke `lat`/`lng` (gagal resolve → 422 `mapsUrl`) | 422 `{ field: 'mapsUrl', message }` |
| `contact` | trim opsional, `@IsString()`, `@MaxLength(200)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'contact', message }` |
| `organisationType` | opsional, `@IsEnum(NetworkOrganisationType)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'organisationType', message }` |
| `ledBy` | trim opsional, `@IsString()`, `@MaxLength(200)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'ledBy', message }` |
| `activityType` | trim opsional, `@IsString()`, `@MaxLength(100)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'activityType', message }` |
| `submitterFullName` | trim opsional (`''`/whitespace → `null`), `@IsString()`, `@MaxLength(200)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'submitterFullName', message }` |
| `submitterEmail` | trim + lowercase opsional (`''`/whitespace → `null`), `@IsEmail()`, `@MaxLength(200)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'submitterEmail', message }` |
| `submitterCountry` | trim opsional (`''`/whitespace → `null`), `@IsString()`, `@MaxLength(100)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'submitterCountry', message }` |
| `submitterState` | trim opsional (`''`/whitespace → `null`), `@IsString()`, `@MaxLength(100)`, nullable (`null` = kosongkan saat update) | 422 `{ field: 'submitterState', message }` |
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
- `filter[status]=PUBLISHED` menambahkan guard `publishedAt != null AND publishedAt <= now` (mirror archive) — konten terjadwal di masa depan tidak ikut list. `GET /networks/:id` **tidak** dibatasi guard ini (editor admin tetap bisa membaca row terjadwal).
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
| `remove(id)` | Pre-check id → 404; lalu delete. Relasi user/event `onDelete: SetNull` (tidak ikut terhapus). |

### Service (`network.service.ts`)

| Method | Fungsi |
| --- | --- |
| `list(query)` | `buildWhere` (filter + date) + `buildSearch` + `combineWhere` + `buildOrderBy`; saat `filter.status=PUBLISHED` tambah `publishedAt: { not: null, lte: now }`; delegasi ke repo. |
| `findOne(id)` | `repository.findById`. |
| `findOrCreateByName(name, { state?, country? })` | Find-or-create untuk submit event publik (`POST /event-submissions`): `findByNameInsensitive(name)` → bila ada kembalikan; bila tidak → `repository.create({ name, state: state ?? null, country: country ?? null })`. Dipanggil di dalam transaksi submit. `name` tidak unik → bisa duplikat (typo); dedupe/merge = backlog. |
| `create(dto)` | Petakan field DTO → `repository.create`. Bila `dto.content !== undefined` → simpan hasil `sanitizeStoryContent(dto.content)`. `website`/`contact`/`organisationType`/`ledBy`/`activityType` → `?? null`; `socialMedia` → `dto.socialMedia ?? undefined` (biarkan DB default NULL bila tidak dikirim). Bila `dto.mapsUrl` ada → resolve server-side (`resolveGoogleMapsLink`, follow shortlink) → tulis `lat`/`lng`/`embedUrl` (**menimpa** `lat`/`lng` klien); gagal resolve → 422 `mapsUrl`. |
| `update(id, dto)` | Kumpulkan hanya field yang `!== undefined`; `content` disanitasi via `sanitizeStoryContent` bila dikirim; `website`/`contact`/`organisationType`/`ledBy`/`activityType` ditulis apa adanya (termasuk `null` = kosongkan); `socialMedia`: `null` → `Prisma.DbNull`, selain itu array `[{ platform, url }]` apa adanya; body kosong → kembalikan `findOne(id)` tanpa update. `mapsUrl`: kosong → `null` (koordinat lama dipertahankan); berbeda dari nilai lama **atau** `lat`/`lng` masih null (row lama) → resolve → set `mapsUrl` + `lat`/`lng`/`embedUrl` (gagal → 422); tidak berubah (sudah berkoordinat) → set `mapsUrl` saja (tanpa jaringan). `mapsUrl` ter-resolve menang atas `lat`/`lng` eksplisit. |
| `remove(id)` | `repository.remove`. |
| `createPublicSubmission(dto)` | Submit publik tanpa JWT. `assertGeography` untuk `countryId`/`stateId` **dan** `submitter.countryId`/`submitter.stateId` (negara wajib ada, state harus milik negara → 422 per-field); helper mengembalikan row hasil lookup sehingga nama dipakai tanpa query ulang. `content` disanitasi + wajib non-kosong (422); `mapsUrl` di-resolve **sebelum** insert. Menulis satu row `networks` (`status=REQUEST`, `source=PUBLIC`, `createdBy: null`) plus `submitterFullName`/`submitterEmail`/`submitterCountry`/`submitterState` (nama negara/state submitter). **Tidak** membuat `User`. Setelah row tersimpan → `NotificationService.notifyAdmins` (`CONTENT_SUBMITTED`, `entityType=NETWORK`, title `name`, link `/dashboard`) ke admin ACTIVE; kegagalan notifikasi tidak menggagalkan submission. Respons `{ id, status }`. |

> **Handling `socialMedia` (Json nullable).** Create: `dto.socialMedia ?? undefined` (tidak mengirim → kolom dibiarkan `NULL` default; tanpa sentinel). Update: hanya bila `dto.socialMedia !== undefined`; `null` → `Prisma.DbNull` (set kolom `NULL`), array → disimpan apa adanya. Array di-map ke plain `{ platform, url }` agar assignable ke `Prisma.InputJsonValue`.

> **Resolusi `mapsUrl` → `lat`/`lng`/`embed_url` (server-side, mirror event).** Helper privat `resolveLocationMaps(mapsUrl)` memakai `resolveGoogleMapsLink` dari `@app/libs/common/utils/google-maps.util` (keyless, mengikuti shortlink, tak pernah throw; `null` → 422 `mapsUrl`). `create` selalu resolve bila `mapsUrl` ada; `update` resolve bila link berubah **atau** row lama masih tanpa koordinat (`lat`/`lng` null → regenerasi saat re-save); `createPublicSubmission` resolve sebelum insert Network (cegah orphan). Koordinat hasil resolve **menimpa** `lat`/`lng` klien dan `embedUrl` diisi dari hasil resolve.

> Tidak ada row-level scoping di modul ini — CRUD network murni admin-only lewat permission. Scoping berbasis `networkId` diterapkan di modul `post`/`event`/`user` (lihat [rbac.md §10](./rbac.md#10-row-level-scoping)).

> **Inter-module:** modul `event` (jalur submit publik) mengimpor `NetworkModule` dan memanggil `NetworkService.findOrCreateByName` saat submit — **bukan** query Prisma lintas modul. `NetworkModule` wajib meng-`exports` service/repository agar bisa di-inject (RULES bab 3/11).

---

## 6. Endpoint & Permission

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta: { page, limit, total }, message }`; error `{ statusCode, message, errors }`.

> Dekorator permission: `network:create|read|update|delete|approve|reject` (rename RBAC v2; role bawaan `organization` dihapus — [rbac.md §7](./rbac.md#7-seed-default)). Usulan network publik (`POST /api/v1/network-submissions`) menulis langsung ke tabel `networks` (`status=REQUEST`, `source=PUBLIC`, `createdBy=null`, identitas pengirim di kolom `submitter_*` — **tanpa** membuat row `User`); review admin lewat filter `filter[status]=REQUEST` + endpoint `approve`/`reject`. Kolom `submitter*` ikut ter-expose di respons network (admin-only).

| Method | Path | Akses | Request | Response sukses | Error |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/networks` | PERMISSION `network:create` | body `CreateNetworkDto` | 201 `{ data: <network>, message }` | 422, 401/403 |
| GET | `/api/v1/networks` | PERMISSION `network:read` | query `ListNetworksQueryDto` | 200 `{ data: [network], meta, message }` | 422 sortBy/filter tak dikenal, 401/403 |
| GET | `/api/v1/networks/:id` | PERMISSION `network:read` | path `id` UUID | 200 `{ data: <network>, message }` | 404, 422 UUID invalid, 401/403 |
| PATCH | `/api/v1/networks/:id` | PERMISSION `network:update` | path `id`, body `UpdateNetworkDto` | 200 `{ data: <network>, message }` | 404, 422, 401/403 |
| DELETE | `/api/v1/networks/:id` | PERMISSION `network:delete` | path `id` UUID | 200 `{ data: <network>, message }` | 404, 422 UUID invalid, 401/403 |
| POST | `/api/v1/networks/:id/approve` | PERMISSION `network:approve` | path `id`, body `PublishContentDto` (`{ publishedAt? }`) | 200 `{ data: <network>, message }` | 404, 409 (status ≠ REQUEST), 422, 401/403 |
| POST | `/api/v1/networks/:id/reject` | PERMISSION `network:reject` | path `id` UUID | 200 `{ data: <network>, message }` | 404, 409 (status ≠ REQUEST), 422 UUID invalid, 401/403 |

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
    "mapsUrl": "https://maps.google.com/?q=-8.4095,115.1889",
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
