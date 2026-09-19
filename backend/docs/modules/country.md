# Module: Country

Menu: [rbac.md](./rbac.md) (master) · [region.md](./region.md)

---

## 1. Deskripsi & Lokasi

Modul `country` menyediakan data referensi negara, sumber [dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database). Read-only: tidak ada endpoint create/update/delete.

Country dimiliki oleh max satu Region (`regionId` nullable, 1 : N dari Region) dan direferensikan `User.countryId → Country.iso2`. Data diisi seeder `libs/prisma/seed-geo.ts` (`pnpm prisma:seed:geo`).

Lokasi kode:

```
libs/src/modules/country/
├── country.repository.ts
├── country.service.ts
├── country.module.ts
└── entities/
    └── country.entity.ts
apps/app/src/controllers/countries.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

---

## 2. Model Prisma

```prisma
model Country {
  id             Int       @id @default(autoincrement())
  name           String
  iso2           String    @unique @db.Char(2)
  iso3           String?   @db.Char(3)
  numericCode    String?   @map("numeric_code")
  phoneCode      String?   @map("phone_code")
  capital        String?
  currency       String?
  currencyName   String?   @map("currency_name")
  currencySymbol String?   @map("currency_symbol")
  tld            String?
  native         String?
  population     BigInt?
  gdp            BigInt?
  regionName     String?   @map("region_name")
  subregion      String?
  nationality    String?
  timezones      Json?
  translations   Json?
  latitude       Decimal?  @db.Decimal(10, 8)
  longitude      Decimal?  @db.Decimal(11, 8)
  emoji          String?
  emojiU         String?   @map("emoji_u")
  wikiDataId     String?   @map("wiki_data_id")
  regionId       Int?      @map("region_id")
  region         Region?   @relation(fields: [regionId], references: [id], onDelete: SetNull)
  users          User[]
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  @@index([regionId])
  @@map("countries")
}
```

- `iso2` unik → upsert seeder by `iso2`; juga target FK `User.countryId`.
- `regionId` nullable + `onDelete: SetNull`; diindeks (`@@index([regionId])`).
- `regionName` = nama region upstream (denormalisasi), `region` = relasi lokal.

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4). `BigInt` tidak bisa di-`JSON.stringify`, jadi `toCountryEntity` mengonversi `population`/`gdp` ke `number | null` (aman untuk rentang data aktual).

```typescript
// libs/src/modules/country/entities/country.entity.ts
import { Prisma } from '@prisma/client';

export const countrySelect = {
  id: true, name: true, iso2: true, iso3: true, numericCode: true,
  phoneCode: true, capital: true, currency: true, currencyName: true,
  currencySymbol: true, tld: true, native: true, population: true, gdp: true,
  regionName: true, subregion: true, nationality: true, timezones: true,
  translations: true, latitude: true, longitude: true, emoji: true,
  emojiU: true, wikiDataId: true, regionId: true,
  region: { select: { id: true, name: true } },
  createdAt: true, updatedAt: true,
} satisfies Prisma.CountrySelect;

export type CountryPayload = Prisma.CountryGetPayload<{ select: typeof countrySelect }>;

export type CountryEntity = Omit<CountryPayload, 'population' | 'gdp'> & {
  population: number | null;
  gdp: number | null;
};

export function toCountryEntity(country: CountryPayload): CountryEntity { /* ... */ }
```

---

## 4. DTO / Query List

List memakai `ListQueryDto` shared (RULES bab 19). Konstanta whitelist di-export dari `country.service.ts`:

| Konstanta | Nilai |
| --- | --- |
| `COUNTRY_FILTER_FIELDS` | `name, iso2, iso3, regionId, createdAt, updatedAt` |
| `COUNTRY_DATE_FIELDS` | `createdAt, updatedAt` (ISO 8601, invalid → 422; `like` ditolak) |
| `COUNTRY_NUMBER_FIELDS` | `regionId` (integer 32-bit, invalid/float → 422) |
| `COUNTRY_SORT_FIELDS` | `name, iso2, iso3, regionName, population, createdAt, updatedAt` |
| `COUNTRY_SEARCHABLE_FIELDS` | `name, iso2, iso3, native, capital, nationality` |

- `filter[regionId]=3` (dan `[in]`, `[ne]`, dll) → integer; `like` → 422.
- `search` di-trim; kosong/<2 char diabaikan (`buildSearch`).
- `sortBy` tak dikenal → 422 (`assertAllowedSort`).
- `:id` path pakai `ParseIntPipe` (bukan UUID).
- Param umum: `page` (default 1), `limit` (default 20, clamp 100), `sortOrder` (`asc`/`desc`, default `desc`).

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `page`, `limit` | `@IsInt()`, `@Min(1)` | 422 `{ field: 'limit', message }` |
| `filter[regionId]` | integer 32-bit | 422 `{ field: 'regionId', message: 'filter[regionId] must be a 32-bit integer' }` |
| `sortBy` | whitelist `COUNTRY_SORT_FIELDS` | 422 `{ statusCode: 422, message: 'Validation failed', errors: [] }` — alasan asli tidak dipertahankan (exception di-throw sebagai string) |
| `:id` path | `ParseIntPipe` | 400 integer invalid |

> Catatan: `http-exception.filter.ts` menyeragamkan **semua** 422 menjadi `{ statusCode: 422, message: 'Validation failed', errors: [...] }`. Exception string dari `list-filter.util.ts` (mis. `sortBy`/`filter` tak dikenal) menghasilkan `errors: []` — pesan spesifik tidak ikut terserialisasi.

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "regionId", "message": "filter[regionId] must be a 32-bit integer" }]
}
```

---

## 5. Endpoint

Semua path memakai prefix **`/api/v1`**. Respon sukses `{ data, message }`; list ber-paginasi `{ data, meta, message }`.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| GET | `/api/v1/countries` | List negara (pagination + search + sort) | PUBLIC (`@Public()`) |
| GET | `/api/v1/countries/:id` | Detail negara by `id` (Int) | PUBLIC (`@Public()`) |

- Dipakai FE untuk dropdown pra-login → `@Public()`. Tanpa permission/RBAC.
- `GET /countries/:id` → 404 `NotFoundException('Country not found')` bila tidak ada.

### Contoh query

- `GET /api/v1/countries?page=1&limit=20&sortBy=name&sortOrder=asc`
- `GET /api/v1/countries?filter[regionId]=3`
- `GET /api/v1/countries?search=indo&filter[regionId][in]=3,5`

### Contoh respons list

```json
{
  "data": [
    { "id": 1, "name": "Indonesia", "iso2": "ID", "iso3": "IDN", "regionId": 3,
      "population": 273523621, "gdp": 1186093454692, "region": { "id": 3, "name": "Asia" } }
  ],
  "meta": { "page": 1, "limit": 20, "total": 250 },
  "message": "success"
}
```

---

## 6. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `GET /countries/:id` | `NotFoundException` | 404 | `id` tidak ada |
| `GET /countries` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, `regionId` bukan integer, `limit` invalid |
| `GET /countries/:id` | `BadRequestException` | 400 | `:id` bukan integer (`ParseIntPipe`) |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).
