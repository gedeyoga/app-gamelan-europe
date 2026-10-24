# Module: City

Menu: [state.md](./state.md) · [country.md](./country.md) · [event.md](./event.md)

---

## 1. Deskripsi & Lokasi

Modul `city` menyediakan data referensi kota, sumber [dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database). Sebagian besar read-only; tersedia **satu** endpoint write: `POST /cities` untuk inline-create kota (idempoten) dari form network (dan form lain). Pola sama dipakai `POST /states` ([state.md](./state.md)).

City dimiliki satu Country (`countryId` non-null, FK `onDelete: Cascade`) dan opsional satu State (`stateId` nullable, FK `onDelete: SetNull`). Data diisi seeder `libs/prisma/seed-geo.ts` (`pnpm prisma:seed:geo`). Seeder **hanya menulis ulang id dataset** cities (`deleteMany` per-id + `createMany`) dan **meng-upsert** states (bukan `deleteMany`), sehingga city hasil inline-create user (id di luar dataset) beserta `stateId`-nya tidak hilang — FK `event_locations.city_id` & `cities.state_id` `ON DELETE SET NULL` akan mencabut referensi bila tabel di-truncate.

> Upstream telah menghapus `json/cities.json`; city kini hanya tersedia nested di `json/countries+states+cities.json` (~47 MB) dan di-seed lewat traversal `country → states → cities`. `stateId` di-set hanya bila State benar-benar di-seed (match `id` upstream), selain itu `null` (aman FK).

Lokasi kode:

```
libs/src/modules/city/
├── city.repository.ts
├── city.service.ts
├── city.module.ts
├── dto/
│   └── create-city.dto.ts
└── entities/
    └── city.entity.ts
apps/app/src/controllers/cities.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

---

## 2. Model Prisma

```prisma
model City {
  id          Int             @id @default(autoincrement())
  name        String
  countryId   Int             @map("country_id")
  country     Country         @relation(fields: [countryId], references: [id], onDelete: Cascade)
  stateId     Int?            @map("state_id")
  state       State?          @relation(fields: [stateId], references: [id], onDelete: SetNull)
  latitude    Decimal?        @db.Decimal(10, 8)
  longitude   Decimal?        @db.Decimal(11, 8)
  wikiDataId  String?         @map("wiki_data_id")
  locations   EventLocation[]
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")

  @@index([countryId])
  @@index([stateId])
  @@map("cities")
}
```

- `id` autoincrement (`@default(autoincrement())`). Seeder geo tetap insert id eksplisit (id upstream) lewat `createMany` → **id eksplisit tidak meng-advance sequence**. Karena itu migrasi `20261006150000_city_id_autoincrement` menambah sequence **dan** `setval`, lalu `seed-geo.ts` menjalankan `setval` lagi **setelah** `createMany` cities (di transaksi yang sama) ke `MAX(id)`. Urutan ini penting di **fresh deploy**: migrasi berjalan saat tabel masih kosong (`setval`=1), jadi hanya `seed-geo` yang meng-advance sequence ke id dataset. Tanpa langkah itu, inline-create pertama `nextval`=2 → tabrakan PK (P2002 → 500). DB dev yang sudah terisi sebelum migrasi "kebetulan aman" saja.
- `stateId` nullable: kota bisa tanpa state; `onDelete: SetNull` (state di-skip/hapus tidak menghapus city).

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4). Dua view: list & detail (+`state`, `country`).

```typescript
// libs/src/modules/city/entities/city.entity.ts
export const citySelect = {
  id: true, name: true, countryId: true, stateId: true, latitude: true,
  longitude: true, wikiDataId: true, createdAt: true, updatedAt: true,
} satisfies Prisma.CitySelect;

export type CityEntity = Prisma.CityGetPayload<{ select: typeof citySelect }>;

export const cityWithRelationsSelect = {
  ...citySelect,
  state: { select: { id: true, name: true } },
  country: { select: { id: true, iso2: true, name: true } },
} satisfies Prisma.CitySelect;

export type CityWithRelationsEntity = Prisma.CityGetPayload<{
  select: typeof cityWithRelationsSelect;
}>;
```

---

## 4. DTO / Query List

List memakai `ListQueryDto` shared (RULES bab 19). Konstanta whitelist di-export dari `city.service.ts`:

| Konstanta | Nilai |
| --- | --- |
| `CITY_FILTER_FIELDS` | `countryId, stateId, createdAt, updatedAt` |
| `CITY_DATE_FIELDS` | `createdAt, updatedAt` |
| `CITY_NUMBER_FIELDS` | `countryId, stateId` |
| `CITY_SORT_FIELDS` | `name, createdAt, updatedAt` |
| `CITY_SEARCHABLE_FIELDS` | `name` |

- `filter[countryId]=101` / `filter[stateId]=1826` → equality (juga `[in]`, `[ne]`, dll).
- `sortBy` tak dikenal → 422 (`assertAllowedSort`); `:id` path pakai `ParseIntPipe`.
- Param umum: `page` (default 1), `limit` (default 20, clamp 100), `sortOrder` (`asc`/`desc`, default `desc`).

### `CreateCityDto`

| Field | Validasi |
| --- | --- |
| `name` | trim, `@IsString` `@IsNotEmpty` `@MaxLength(150)` |
| `countryId` | `@Type(() => Number)` `@IsInt` — wajib |
| `stateId` | opsional, `@Type(() => Number)` `@IsInt` |

---

## 5. Endpoint

Semua path memakai prefix **`/api/v1`**. Respon sukses `{ data, message }`; list ber-paginasi `{ data, meta, message }`.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/cities` | Inline-create city (idempoten) | PERMISSION `city:create` |
| GET | `/api/v1/cities` | List city (pagination + search + sort) | PUBLIC (`@Public()`) |
| GET | `/api/v1/cities/:id` | Detail city by `id` (Int), + `state`, `country` | PUBLIC (`@Public()`) |

- `POST /cities` → **201** `{ data, message }`; idempoten: `name` sama (case-insensitive) + `countryId` + `stateId` mengembalikan baris existing (id sama, bukan 409). Tanpa token → 401; tanpa permission → 403.
- `GET` dipakai FE untuk dropdown pra-login → `@Public()`. Tanpa permission/RBAC.
- `GET /cities/:id` → 404 `NotFoundException('City not found')` bila tidak ada.

### Contoh body `POST /cities`

```json
{ "name": "Uji Kota XYZ", "countryId": 101, "stateId": 1826 }
```

### Contoh query

- `GET /api/v1/cities?filter[countryId]=101&sortBy=name&sortOrder=asc`
- `GET /api/v1/cities?filter[stateId]=1826`
- `GET /api/v1/cities?search=denpasar&limit=50`

---

## 6. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `POST /cities` | `UnprocessableEntityException` | 422 | `countryId` tidak ada → `{ field: "countryId", message: "countryId does not exist" }`; `stateId` tidak ada atau bukan milik `countryId` → `{ field: "stateId", message: "stateId must belong to countryId" }` |
| `POST /cities` | `UnauthorizedException` / `ForbiddenException` | 401 / 403 | tanpa token / tanpa permission `city:create` |
| `GET /cities/:id` | `NotFoundException` | 404 | `id` tidak ada |
| `GET /cities` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, `countryId`/`stateId` bukan integer, `limit` invalid |
| `GET /cities/:id` | `BadRequestException` | 400 | `:id` bukan integer (`ParseIntPipe`) |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).

---

## 7. RBAC

- Permission baru `city:create` didaftarkan di `libs/prisma/seed-data.ts`.
- `seed.ts`: `city:create` masuk `MEMBER_PERMISSION_CODES` → role `member` & `author` bisa inline-create city dari form network (dan form lain); `admin` otomatis semua.
- Jalankan `pnpm prisma:seed` (idempoten) setelah menambah permission.
