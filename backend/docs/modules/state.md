# Module: State

Menu: [rbac.md](./rbac.md) (master) · [country.md](./country.md) · [region.md](./region.md)

---

## 1. Deskripsi & Lokasi

Modul `state` menyediakan data referensi provinsi/state, sumber [dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database). Sebagian besar read-only; tersedia **satu** endpoint write: `POST /states` untuk inline-create state (idempoten) dari form network (dan form lain) — pola sama dengan `POST /cities`.

State dimiliki oleh satu Country (`countryId` non-null, 1 : N dari Country, `onDelete: Cascade`). `parentId` disimpan sebagai scalar (tanpa self-relation). Data diisi seeder `libs/prisma/seed-geo.ts` (`pnpm prisma:seed:geo`).

Lokasi kode:

```
libs/src/modules/state/
├── state.repository.ts
├── state.service.ts
├── state.module.ts
├── dto/
│   └── create-state.dto.ts
└── entities/
    └── state.entity.ts
apps/app/src/controllers/states.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

---

## 2. Model Prisma

```prisma
model State {
  id           Int      @id
  name         String
  countryCode  String   @map("country_code") @db.Char(2)
  fipsCode     String?  @map("fips_code")
  iso2         String?
  iso3166_2    String?
  type         String?
  level        Int?
  parentId     Int?     @map("parent_id")
  native       String?
  latitude     Decimal? @db.Decimal(10, 8)
  longitude    Decimal? @db.Decimal(11, 8)
  timezone     String?
  translations Json?
  wikiDataId   String?  @map("wiki_data_id")
  countryId    Int      @map("country_id")
  country      Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@index([countryId])
  @@index([countryCode])
  @@map("states")
}
```

- `id` = id upstream (eksplisit, tanpa autoincrement) → dipakai seeder replace penuh.
- State hasil inline-create (`POST /states`) memakai **id negatif** (`Math.min(_min.id, 0) - 1`) agar import dataset GeoDB (id positif) tidak pernah tabrakan; `countryCode` diisi dari `country.iso2`. Kalau nanti butuh urutan id manual, tambah kolom sequence/autoincrement khusus saat itu.
- `countryCode` (ISO-2) disimpan untuk query cepat; `countryId` = relasi lokal.
- `countryId` + `countryCode` diindeks.

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4). Dua view: list (tanpa relasi) & detail (+`country`).

```typescript
// libs/src/modules/state/entities/state.entity.ts
import { Prisma } from '@prisma/client';

export const stateSelect = {
  id: true, name: true, countryCode: true, iso2: true, iso3166_2: true, type: true,
  level: true, native: true, latitude: true, longitude: true, timezone: true,
  wikiDataId: true, countryId: true, createdAt: true, updatedAt: true,
} satisfies Prisma.StateSelect;

export type StateEntity = Prisma.StateGetPayload<{ select: typeof stateSelect }>;

export const stateWithCountrySelect = {
  ...stateSelect,
  country: { select: { id: true, iso2: true, name: true } },
} satisfies Prisma.StateSelect;

export type StateWithCountryEntity = Prisma.StateGetPayload<{
  select: typeof stateWithCountrySelect;
}>;
```

- `latitude`/`longitude` `Decimal` diserialisasi Prisma sebagai string (tidak butuh konversi manual).

---

## 4. DTO / Query List

List memakai `ListQueryDto` shared (RULES bab 19). Konstanta whitelist di-export dari `state.service.ts`:

| Konstanta | Nilai |
| --- | --- |
| `STATE_FILTER_FIELDS` | `countryId, countryCode, type, level, createdAt, updatedAt` |
| `STATE_DATE_FIELDS` | `createdAt, updatedAt` (ISO 8601, invalid → 422; `like` ditolak) |
| `STATE_NUMBER_FIELDS` | `countryId, level` (integer 32-bit, invalid/float → 422) |
| `STATE_SORT_FIELDS` | `name, countryCode, type, level, createdAt, updatedAt` |
| `STATE_SEARCHABLE_FIELDS` | `name, native` |

- `filter[countryId]=101` / `filter[countryCode]=ID` → equality (juga `[in]`, `[ne]`, dll).
- `filter[countryCode]` = exact match case-sensitive pada `@db.Char(2)` → pakai ISO-2 uppercase (`ID`, bukan `id`).
- `search` di-trim; kosong/<2 char diabaikan (`buildSearch`).
- `sortBy` tak dikenal → 422 (`assertAllowedSort`).
- `:id` path pakai `ParseIntPipe` (bukan UUID).
- Param umum: `page` (default 1), `limit` (default 20, clamp 100), `sortOrder` (`asc`/`desc`, default `desc`).

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `page`, `limit` | `@IsInt()`, `@Min(1)` | 422 `{ field: 'limit', message }` |
| `filter[countryId]`, `filter[level]` | integer 32-bit | 422 `{ field: 'countryId', message: 'filter[countryId] must be a 32-bit integer' }` |
| `sortBy` | whitelist `STATE_SORT_FIELDS` | 422 `{ statusCode: 422, message: 'Validation failed', errors: [] }` — alasan asli tidak dipertahankan (exception di-throw sebagai string) |
| `:id` path | `ParseIntPipe` | 400 integer invalid |

> Catatan: `http-exception.filter.ts` menyeragamkan **semua** 422 menjadi `{ statusCode: 422, message: 'Validation failed', errors: [...] }`. Exception string dari `list-filter.util.ts` (mis. `sortBy`/`filter` tak dikenal) menghasilkan `errors: []` — pesan spesifik tidak ikut terserialisasi.

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "countryId", "message": "filter[countryId] must be a 32-bit integer" }]
}
```

---

## 5. Endpoint

Semua path memakai prefix **`/api/v1`**. Respon sukses `{ data, message }`; list ber-paginasi `{ data, meta, message }`.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/states` | Inline-create state (idempoten) | PERMISSION `state:create` |
| GET | `/api/v1/states` | List state (pagination + search + sort) | PUBLIC (`@Public()`) |
| GET | `/api/v1/states/:id` | Detail state by `id` (Int), + `country` | PUBLIC (`@Public()`) |

- `POST /states` → **201** `{ data, message }`; idempoten: `name` sama (case-insensitive) + `countryId` mengembalikan baris existing (id sama, bukan 409). Tanpa token → 401; tanpa permission → 403.
- Dipakai FE untuk dropdown pra-login → `@Public()`. Tanpa permission/RBAC.
- `GET /states/:id` → 404 `NotFoundException('State not found')` bila tidak ada.

### DTO `CreateStateDto`

| Field | Validasi |
| --- | --- |
| `name` | trim, `@IsString` `@IsNotEmpty` `@MaxLength(150)` |
| `countryId` | `@Type(() => Number)` `@IsInt` — wajib |

### Contoh body `POST /states`

```json
{ "name": "Uji Provinsi XYZ", "countryId": 101 }
```

### Contoh respons `POST /states`

```json
{
  "data": { "id": -1, "name": "Uji Provinsi XYZ", "countryCode": "ID", "countryId": 101, "iso2": null },
  "message": "success"
}
```

`countryCode` diambil dari `country.iso2` (uppercase seperti tersimpan) supaya `filter[countryCode]` pada list tetap menemukan state baru.

### Contoh query

- `GET /api/v1/states?page=1&limit=20&sortBy=name&sortOrder=asc`
- `GET /api/v1/states?filter[countryCode]=ID`
- `GET /api/v1/states?filter[countryId]=101`
- `GET /api/v1/states?filter[countryCode]=ID&search=java`
- `GET /api/v1/states?filter[level]=1&filter[type]=province`

### Contoh respons list

```json
{
  "data": [
    { "id": 1826, "name": "Bali", "countryCode": "ID", "iso2": "BA", "iso3166_2": "ID-BA",
      "type": "province", "level": 1, "timezone": "Asia/Makassar", "countryId": 101 }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45 },
  "message": "success"
}
```

### Contoh respons detail

```json
{
  "data": { "id": 1826, "name": "Bali", "countryId": 101, "country": { "id": 101, "iso2": "ID", "name": "Indonesia" } },
  "message": "success"
}
```

---

## 6. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `POST /states` | `UnprocessableEntityException` | 422 | `countryId` tidak ada → `{ field: "countryId", message: "countryId does not exist" }` |
| `POST /states` | `UnauthorizedException` / `ForbiddenException` | 401 / 403 | tanpa token / tanpa permission `state:create` |
| `GET /states/:id` | `NotFoundException` | 404 | `id` tidak ada |
| `GET /states` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, `countryId`/`level` bukan integer, `limit` invalid |
| `GET /states/:id` | `BadRequestException` | 400 | `:id` bukan integer (`ParseIntPipe`) |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).

---

## 7. RBAC

- Permission `state:create` didaftarkan di `libs/prisma/seed-data.ts`.
- `seed.ts`: `state:create` masuk `MEMBER_PERMISSION_CODES` → role `member` & `author` bisa inline-create state dari form network (dan form lain); `admin` otomatis semua.
- Jalankan `pnpm prisma:seed` (idempoten) setelah menambah permission.
