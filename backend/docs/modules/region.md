# Module: Region

Menu: [rbac.md](./rbac.md) (master) · [country.md](./country.md)

---

## 1. Deskripsi & Lokasi

Modul `region` menyediakan data referensi wilayah geografis (benua), sumber [dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database). Read-only: tidak ada endpoint create/update/delete.

Region menampung banyak Country (1 : N). Data diisi seeder `libs/prisma/seed-geo.ts` (`pnpm prisma:seed:geo`).

Lokasi kode:

```
libs/src/modules/region/
├── region.repository.ts
├── region.service.ts
├── region.module.ts
└── entities/
    └── region.entity.ts
apps/app/src/controllers/regions.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

---

## 2. Model Prisma

```prisma
model Region {
  id           Int       @id @default(autoincrement())
  name         String    @unique
  translations Json?
  wikiDataId   String?   @map("wiki_data_id")
  countries    Country[]
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@map("regions")
}
```

- `name` unik → upsert seeder by `name`.
- `id` autoincrement (upstream id tidak dipakai; relasi Country memakai id lokal).

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4). `_count.countries` = jumlah negara per region.

```typescript
// libs/src/modules/region/entities/region.entity.ts
import { Prisma } from '@prisma/client';

export const regionSelect = {
  id: true,
  name: true,
  wikiDataId: true,
  _count: { select: { countries: true } },
} satisfies Prisma.RegionSelect;

export type RegionEntity = Prisma.RegionGetPayload<{ select: typeof regionSelect }>;
```

---

## 4. Endpoint

Semua path memakai prefix **`/api/v1`**. Respon sukses `{ data, message }`.

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| GET | `/api/v1/regions` | List semua region, urut `name ASC`, tiap item menyertakan `_count.countries` | PUBLIC (`@Public()`) |

- Dipakai FE untuk dropdown pra-login → `@Public()`.
- **Tanpa pagination** (jumlah region tetap, 6 baris) — tidak memakai `ListQueryDto`.
- Tidak ada filter/sort/search query param.
- `GET /regions` tidak menerima `:id` detail di iterasi ini.

### Contoh respons

```json
{
  "data": [
    { "id": 3, "name": "Asia", "wikiDataId": "Q48", "_count": { "countries": 50 } }
  ],
  "message": "success"
}
```

---

## 5. Error & Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `GET /regions` | — | 200 | selalu sukses (data kosong → `data: []`) |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).
