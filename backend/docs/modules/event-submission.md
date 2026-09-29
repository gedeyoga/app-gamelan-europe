# Module: Event Submission

Menu: [event.md](./event.md) (pola acuan) · [state.md](./state.md) · [country.md](./country.md) · [rbac.md](./rbac.md) (master)

> **STATUS: RENCANA — BELUM DIIMPLEMENTASIKAN.** Tidak ada `schema.prisma` entry, service, repository, controller, DTO, permission seed, maupun migration untuk `EventSubmission` saat dokumen ini ditulis. Semua isi dokumen bersifat **spesifikasi final yang akan diimplementasikan**. Tandai setiap langkah saat mulai mengerjakan.

---

## 1. Deskripsi & Lokasi

Fitur **Event Submission**: orang di luar EGS (tanpa akun) mengusulkan event lewat form publik. Backend menyimpan usulan di tabel tersendiri `event_submissions`; admin meninjau lewat endpoint admin (approve/reject). **Approve bukan sekadar ubah status**: usulan yang disetujui **di-recreate** menjadi row `Event` `status=DRAFT` (`publishedAt=null`), lalu admin **mengedit + mem-publish** event tersebut lewat alur publish modul event yang sudah ada (lihat §5.2). Approve **tidak** langsung menayangkan event di website EGS.

**Semua submission yang masuk adalah publik anonim** dan muncul di dashboard admin. Dashboard admin tidak memakai endpoint baru: ia mengonsumsi list admin `GET /event-submissions` yang difilter `status` (§5.3, §9.3).

> **KEPUTUSAN PRODUK (RENCANA).** Repo FE ini **tidak punya halaman create submission**; halaman publik `/submit-event` **dibatalkan**. Endpoint `POST /event-submissions` + `POST /event-submissions/thumbnail` tetap **disiapkan sebagai API untuk konsumen eksternal** (mis. website EGS) — **bukan** dipanggil FE repo ini. FE repo ini hanya memakai `GET /event-submissions` (list) + `POST /:id/approve` / `POST /:id/reject`. Kontrak create/list/approve/reject **tidak berubah**; **thumbnail berubah** — field `files` (array, maks 10) + respons `ImageResponse[]` (breaking untuk konsumen eksternal, §5.1).

Karakteristik:

- **Satu jalur: publik anonim** — `POST /event-submissions` (form website EGS, `@Public()`), memakai `CreateEventSubmissionDto`, menghasilkan `status=REQUEST`, dan masuk antrean review admin (approve/reject).
- **Tanpa autentikasi** untuk endpoint publik (`POST /event-submissions`, `POST /event-submissions/thumbnail`, `GET /event-types`).
- **Tabel terpisah** dari `events` saat submit; approve membuat `Event` `DRAFT` dan menautkannya via `EventSubmission.eventId` (§5.2). Submission **tidak dihapus** setelah approve — tetap tersimpan sebagai audit (`status=APPROVED`, `eventId` terisi).
- Status: `REQUEST` (default) → `APPROVED` / `REJECTED` (final). Hanya `APPROVED` yang membuat `Event` (`DRAFT`); `REJECTED` tidak.
- FK geo: `countryId` wajib, `stateId` opsional; `eventTypeId` wajib.
- Thumbnail disimpan sebagai URL hasil upload (`POST /event-submissions/thumbnail`), bukan binary.

### Lokasi kode (rencana)

```
libs/src/modules/event-submission/
├── event-submission.repository.ts
├── event-submission.service.ts
├── event-submission.module.ts
├── dto/
│   └── create-event-submission.dto.ts
└── entities/
    └── event-submission.entity.ts

apps/app/src/controllers/
└── event-submissions.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

Alur baku `Controller → Service → Repository → Prisma`; repository satu-satunya tempat query Prisma (RULES bab 3). Modul didaftarkan di `libs/src/libs.module.ts` (imports + exports) dan controller di `apps/app/src/app.module.ts` — mengikuti modul `subscription`.

Perubahan file existing (rencana):

| File | Perubahan |
| --- | --- |
| `libs/prisma/schema.prisma` | tambah `enum EventSubmissionStatus` + `model EventSubmission` (+ relasi `eventId` ke `Event`) + back-relation di `Country`/`State`/`EventType`/`Event` (§2). |
| `libs/prisma/seed.ts` | tambah **3** permission `event-submission:*` (`read`/`approve`/`reject`) ke `DEFAULT_PERMISSIONS` + naikkan hitungan `rbac.md` §7 (62 → 65). |
| `apps/app/src/controllers/event-types.controller.ts` | `GET` dari `@Permissions('event-type:read')` → `@Public()` (§5). |
| `libs/src/modules/image/dto/upload-image.dto.ts` | tambah `'event-submission'` ke `@IsIn` `UploadImageDto` (§5). |

---

## 2. Model Prisma

**Belum ada.** Tambahkan ke `libs/prisma/schema.prisma` (satu-satunya sumber entity, RULES bab 4):

```prisma
enum EventSubmissionStatus {
  REQUEST
  APPROVED
  REJECTED
}

model EventSubmission {
  id               String                @id @default(uuid())
  title            String
  startDate        DateTime              @map("start_date") @db.Date
  endDate          DateTime              @map("end_date") @db.Date
  countryId        Int                   @map("country_id")
  country          Country               @relation("EventSubmissionCountry", fields: [countryId], references: [id], onDelete: Restrict)
  stateId          Int?                  @map("state_id")
  state            State?                @relation("EventSubmissionState", fields: [stateId], references: [id], onDelete: SetNull)
  organiser        String
  // Section `author` (data pengirim): audit-only, bukan bagian dari Event saat approve.
  authorFullName   String                @map("author_full_name")
  authorEmail      String                @map("author_email")
  authorCountryId  Int                   @map("author_country_id")
  authorCountry    Country               @relation("EventSubmissionAuthorCountry", fields: [authorCountryId], references: [id], onDelete: Restrict)
  authorStateId    Int?                  @map("author_state_id")
  authorState      State?                @relation("EventSubmissionAuthorState", fields: [authorStateId], references: [id], onDelete: SetNull)
  eventTypeId      String?               @map("event_type_id")
  eventType        EventType?            @relation(fields: [eventTypeId], references: [id], onDelete: SetNull)
  shortDescription String                @map("short_description")
  thumbnail        String?
  status           EventSubmissionStatus @default(REQUEST)
  adminNote        String?               @map("admin_note")
  reviewedBy       String?               @map("reviewed_by")
  reviewedAt       DateTime?             @map("reviewed_at")
  eventId          String?               @unique @map("event_id")
  event            Event?                @relation(fields: [eventId], references: [id], onDelete: SetNull)
  createdAt        DateTime              @default(now()) @map("created_at")
  updatedAt        DateTime              @updatedAt @map("updated_at")

  @@index([status])
  @@index([countryId])
  @@map("event_submissions")
}
```

**Back-relation yang wajib ditambahkan** (tanpa ini `prisma validate` gagal):

```prisma
model Country {  // tambah baris
  eventSubmissions       EventSubmission[] @relation("EventSubmissionCountry")
  authorEventSubmissions EventSubmission[] @relation("EventSubmissionAuthorCountry")
}
model State {    // tambah baris
  eventSubmissions       EventSubmission[] @relation("EventSubmissionState")
  authorEventSubmissions EventSubmission[] @relation("EventSubmissionAuthorState")
}
model EventType {  // tambah baris
  eventSubmissions EventSubmission[]
}
model Event {      // tambah baris (back-relation dari EventSubmission.eventId)
  submission EventSubmission?
}
```

Catatan:

- `eventId @unique` + `event` relasi opsional (`onDelete: SetNull`) → satu submission hanya boleh menunjuk satu `Event`; approve ganda tidak bisa membuat `Event` dobel (idempotensi, §5.2). `SetNull` → hapus `Event` tidak menghapus submission (jejak audit tetap), `eventId` jadi null.
- `organiser` **tetap `String`** (bukan relasi `Network`). Organisasi **tidak** dibuat dari submit publik; `Network` di-resolve **find-or-create saat approve** (§5.2.1) agar input publik tak termoderasi tidak bisa membuat row `Network` (cegah org spam, §8 poin 13).
- Section **`author`** (data pengirim) disimpan sebagai 4 kolom flat: `author_full_name` (+`author_country_id` FK `Restrict`, `author_state_id` FK `SetNull`) dan **audit-only** — tidak pernah disalin ke `Event` saat approve. Relasi `authorCountry`/`authorState` memakai nama relasi eksplisit (`EventSubmissionAuthorCountry`/`EventSubmissionAuthorState`) karena `Country`/`State` kini punya dua relasi ke `EventSubmission`; relasi `country`/`state` yang lama ikut dinamai (`EventSubmissionCountry`/`EventSubmissionState`).
- **BREAKING (API publik).** `author` **wajib** di `POST /event-submissions`; konsumen eksternal (website EGS) yang tidak mengirimnya kini mendapat **422**. Migration `20260929160000_add_event_submission_author` mem-backfill baris lama: `author_full_name`/`author_email` = `''`, `author_country_id` = `country_id` event, `author_state_id` = `NULL`.
- `start_date`/`end_date` `@db.Date` → tersimpan sebagai tanggal (UTC midnight), cocok untuk input `"YYYY-MM-DD"`.
- `country` `onDelete: Restrict` → tidak boleh hapus Country yang masih dirujuk submission.
- `state`/`eventType` `onDelete: SetNull` (relasinya nullable).
- `reviewedBy` **scalar tanpa relasi** ke `User` (disengaja; kolom audit saja). Bila review-user perlu di-join, tambahkan relasi terpisah di iterasi lain.
- Migration baru diperlukan, mis. `pnpm prisma migrate dev --name add_event_submissions` (ikuti konvensi nama migration repo), lalu `pnpm prisma:generate`.

---

## 3. Entity Payload

Ikuti RULES bab 4 (satu `select` + `Prisma.GetPayload`). Dua view: list admin (flatten join `country`/`state`/`eventType`) & detail.

```typescript
// libs/src/modules/event-submission/entities/event-submission.entity.ts
import { Prisma } from '@prisma/client';

export const eventSubmissionSelect = {
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  countryId: true,
  stateId: true,
  organiser: true,
  authorFullName: true,
  authorEmail: true,
  authorCountryId: true,
  authorStateId: true,
  eventTypeId: true,
  shortDescription: true,
  thumbnail: true,
  status: true,
  adminNote: true,
  reviewedBy: true,
  reviewedAt: true,
  eventId: true,
  createdAt: true,
  updatedAt: true,
  country: { select: { id: true, iso2: true, name: true } },
  state: { select: { id: true, name: true } },
  eventType: { select: { id: true, name: true } },
  authorCountry: { select: { id: true, iso2: true, name: true } },
  authorState: { select: { id: true, name: true } },
} satisfies Prisma.EventSubmissionSelect;

export type EventSubmissionPayload = Prisma.EventSubmissionGetPayload<{
  select: typeof eventSubmissionSelect;
}>;

// Section `author` (data pengirim). Kolom flat `author*` TIDAK pernah bocor ke API.
export type EventSubmissionAuthorEntity = {
  fullName: string;
  email: string;
  countryId: number;
  stateId: number | null;
  country: { id: number; iso2: string; name: string } | null;
  state: { id: number; name: string } | null;
};

// Mapper mapEventSubmission() flatten join → field datar (ikuti pola mapEvent() di event.md §3):
export type EventSubmissionEntity = Omit<
  EventSubmissionPayload,
  | 'country'
  | 'state'
  | 'eventType'
  | 'authorFullName'
  | 'authorEmail'
  | 'authorCountryId'
  | 'authorStateId'
  | 'authorCountry'
  | 'authorState'
> & {
  country: { id: number; iso2: string; name: string } | null;
  state: { id: number; name: string } | null;
  eventType: { id: string; name: string } | null;
  author: EventSubmissionAuthorEntity;
};
```

`mapEventSubmission()` mem-flatten `country`/`state`/`eventType` → objek `{ id, name }` (null bila kosong), mengikuti pola `mapEvent()`. Section **`author`** dipetakan ke objek **nested** `{ fullName, email, countryId, stateId, country: { id, iso2, name } | null, state: { id, name } | null }`; kolom flat `authorFullName`/`authorEmail`/`authorCountryId`/`authorStateId` **tidak pernah** muncul di level atas response. Join shape mentah tidak bocor ke service/controller. List admin **wajib** menyertakan nama `country`/`state`/`eventType` (flatten join), bukan hanya id.

---

## 4. DTO

### `CreateEventSubmissionDto`

File: `libs/src/modules/event-submission/dto/create-event-submission.dto.ts`. Tiru pola `CreateEventDto` (RULES bab 4).

| Field | Aturan |
| --- | --- |
| `title` | `@Transform(({ value }) => value?.trim())`, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `startDate` | `@IsISO8601()` (tanggal `"YYYY-MM-DD"`) |
| `endDate` | `@IsISO8601()`; validasi cross-field `endDate >= startDate` → **422** |
| `countryId` | `@IsInt()`; wajib ada (cek relasi) |
| `stateId` | opsional `@IsInt()`; bila ada wajib milik `countryId` yang sama → **422** |
| `organiser` | `@Transform(trim)`, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `author` | **wajib**, `@IsNotEmptyObject()`, `@ValidateNested()`, `@Type(() => EventSubmissionAuthorDto)` — section terpisah "data pengirim", bukan bagian dari geo/organiser event (`EventSubmissionAuthorDto`) |
| `author.fullName` | `@Transform(trim)`, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `author.email` | `@Transform(trim+lowercase)`, `@IsEmail()`, `@MaxLength(200)` |
| `author.countryId` | `@Type(() => Number)`, `@IsInt()`; wajib ada (cek relasi) |
| `author.stateId` | opsional `@Type(() => Number)`, `@IsInt()`; bila ada wajib milik `author.countryId` → **422** |
| `eventTypeId` | `@IsUUID('4')` (wajib) |
| `shortDescription` | `@Transform(trim)`, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(500)` |
| `thumbnail` | opsional `@IsString()`, `@MaxLength(2048)` |

`forbidNonWhitelisted` (§8 poin 2) **menolak** body yang menyertakan `status`/`reviewedBy`/`eventId` dengan **422**; klien tidak dapat menyuntik field server-derived.

Cross-field & relasi:

- `endDate >= startDate` — validasi DTO (custom validator / `@ValidateIf`), gagal → **422** per-field (`endDate`).
- `countryId` ada di DB — service cek via `CountryRepository`/query; tidak ada → **422** (bukan 404; ini field body trust boundary).
- `stateId` milik `countryId` sama — service cek; mismatch → **422** per-field (`stateId`).
- `author.countryId` ada di DB — service cek; tidak ada → **422** per-field (`author.countryId`).
- `author.stateId` milik `author.countryId` sama — service cek; mismatch → **422** per-field (`author.stateId`, pesan `author.stateId must belong to author.countryId`).
- `eventTypeId` ada di DB — service cek; tidak ada → **422** per-field (`eventTypeId`).

> `ponytail:` cek relasi country/state/eventType dilakukan di service (query by id), bukan `Promise.all` terpisah — cukup 2–3 `findUnique`. Optimalkan bila endpoint jadi hot path.

### Contoh payload request

```json
{
  "title": "Gamelan Workshop Amsterdam",
  "startDate": "2026-10-01",
  "endDate": "2026-10-02",
  "countryId": 153,
  "stateId": 2751,
  "organiser": "Gamelan Foundation NL",
  "author": {
    "fullName": "Budi Santoso",
    "email": "budi@example.com",
    "countryId": 101,
    "stateId": 5
  },
  "eventTypeId": "8f14e45f-ceea-4b3f-a1d7-9e0e5a0f3b21",
  "shortDescription": "Dua hari workshop gamelan untuk pemula.",
  "thumbnail": "https://cdn.example.com/event-submission/abc.jpg"
}
```

### Contoh 422 (validasi per-field)

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    { "field": "title", "message": "title should not be empty" },
    { "field": "endDate", "message": "endDate must not be before startDate" }
  ]
}
```

### Contoh 422 (relasi tidak valid)

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "stateId", "message": "stateId must belong to countryId" }]
}
```

---

## 5. Endpoint

Semua path prefix **`/api/v1`** (RULES bab 1). Sukses `{ data, message }`; list `{ data, meta, message }`; error `{ statusCode, message, errors }` (RULES bab 5).

### 5.1 PUBLIK (`@Public()`, tanpa RBAC)

**`@Public()` = bypass penuh deny-by-default.** Guard `JwtAuthGuard` dan `PermissionsGuard` (rbac.md §6) melewatkan endpoint `@Public()` tanpa JWT **dan** tanpa cek metadata `@Permissions` — jadi **tidak ada permission yang dibutuhkan** untuk submit publik. Menambah `@Permissions` pada endpoint `@Public()` tidak berefek (guard sudah lolos lebih dulu) — jangan lakukan.

> **KEPUTUSAN PRODUK (RENCANA).** `POST /event-submissions` + `POST /event-submissions/thumbnail` dipertahankan sebagai **API konsumen eksternal** (mis. website EGS); **tidak ada UI create di repo FE ini** (halaman `/submit-event` dibatalkan, §1). `GET /event-types` tetap `@Public()` sebagai referensi non-sensitif. FE repo ini hanya mengonsumsi `GET /event-submissions` (list admin) + `POST /:id/approve` / `POST /:id/reject` (§5.2).

| Method | Path | Deskripsi | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/event-submissions` | Buat usulan event, `status=REQUEST` | `CreateEventSubmissionDto` (JSON) | 201 `{ data: { id, status }, message }` |
| POST | `/api/v1/event-submissions/thumbnail` | Upload thumbnail usulan (multi-file, `files`) | multipart `files` (1–10) | 201 `{ data: ImageResponse[], message }` |
| GET | `/api/v1/event-types` | Opsi dropdown tipe event form publik | `ListQueryDto` | 200 `{ data, meta, message }` |

- `POST /event-submissions` → service `create()` men-set `status=REQUEST`, lalu balikan **hanya** `{ id, status }` (bukan seluruh row — cegah PII/echo, §8 poin 11). 422 validasi per-field.
- `POST /event-submissions/thumbnail` → panggil `ImageService.upload(file, 'event-submission')` untuk **setiap** file di array; **hardcode** `entityType` di controller, **jangan** terima dari body publik. Field multipart `files` (**array**, 1–10; `MulterUploadManyInterceptor`), respons array `ImageResponse[]` (tiap item bentuk `{ id, url, variants[] }` — boleh sertakan `key`, `filename` dll sesuai `ImageService.toImageResponse`). **Endpoint ini TIDAK di-throttle** (keputusan): batas abuse = maks 10 file/request. `files` kosong/hilang → **422** `{ field: 'files', message: 'files must not be empty' }`; >10 file → **422** `{ field: 'files', message: 'at most 10 files are allowed' }`; file > `UPLOAD_MAX_SIZE_MB` → **422** `{ field: 'files', message: 'files must each be at most <UPLOAD_MAX_SIZE_MB> MB' }`.
- `GET /event-types` → **perubahan**: dari `@Permissions('event-type:read')` → `@Public()` agar dropdown form publik memuat opsi tipe event (referensi non-sensitif). Catat di `event.md` §7 + `rbac.md` bila perlu. Endpoint `POST /event-types` tetap butuh `event-type:create`.

Contoh request (create):

```http
POST /api/v1/event-submissions
Content-Type: application/json

{ "title": "Gamelan Workshop Amsterdam", "startDate": "2026-10-01", "endDate": "2026-10-02",
  "countryId": 153, "stateId": 2751, "organiser": "Gamelan Foundation NL",
  "eventTypeId": "8f14e45f-ceea-4b3f-a1d7-9e0e5a0f3b21",
  "shortDescription": "Dua hari workshop gamelan untuk pemula." }
```

Contoh respons 201 (**hanya** `{ id, status }` — tanpa echo row/PII):

```json
{
  "data": { "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "status": "REQUEST" },
  "message": "success"
}
```

> Data lengkap (title, tanggal, geo, dll) **tidak** dikembalikan ke pemanggil anonim; admin membacanya lewat `GET /event-submissions` (§5.2).

Contoh respons upload thumbnail (**BREAKING**: dulu objek tunggal, kini array):

```json
{
  "data": [
    {
      "id": "9c1d2e3f-0000-1111-2222-333344445555",
      "url": "https://cdn.example.com/posts/abc-large.webp",
      "variants": [
        { "name": "thumbnail", "url": "https://cdn.example.com/posts/abc-thumb.webp" },
        { "name": "large", "url": "https://cdn.example.com/posts/abc-large.webp" }
      ]
    }
  ],
  "message": "success"
}
```

### 5.2 ADMIN (auth + permission)

| Method | Path | Permission | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/event-submissions` | `event-submission:read` | `ListEventSubmissionsQueryDto` | 200 `{ data, meta, message }` |
| GET | `/api/v1/event-submissions/:id` | `event-submission:read` | `id` UUID (`ParseUUIDPipe`) | 200 `{ data, message }` |
| POST | `/api/v1/event-submissions/:id/approve` | `event-submission:approve` | body opsional `{ adminNote? }` | 200 `{ data: { submission, event: { id, slug, status: 'DRAFT' } }, message }` |
| POST | `/api/v1/event-submissions/:id/reject` | `event-submission:reject` | body `{ adminNote? }` | 200 `{ data, message }` |

- `GET /event-submissions` — list paginasi + search + sort (kontrak §5.3). **Dashboard admin memakai endpoint ini** (tanpa endpoint dashboard/stats baru): `GET /event-submissions?filter[status]=REQUEST`; jumlah cukup dibaca dari `meta.total` per filter (§9.3). Controller mengembalikan `{ data: items, meta: { page, limit: Math.min(query.limit ?? 20, 100), total } }` (ikuti `event-types.controller.ts`).
- `GET /event-submissions/:id` — `ParseUUIDPipe`; tidak ada → 404 `NotFoundException('Event submission not found')`.
- `POST .../approve` — **membuat `Event` `status=DRAFT`** (`publishedAt=null`) dalam satu transaksi (alur lengkap §5.2.1). Response menyertakan `event.id` agar FE admin dapat **redirect ke `/events/:id/edit`**. Body opsional `{ adminNote? }` (DTO kecil `ReviewEventSubmissionDto`).
- `POST .../reject` — set `status=REJECTED`, `reviewedBy=user.id`, `reviewedAt=now`. Body `{ adminNote? }`. **Tidak** membuat `Event`.
- Perubahan status pada row yang **sudah final** (`APPROVED`/`REJECTED`) → **409** `ConflictException` (mis. `Cannot approve event submission in status APPROVED`). Conditional update (`updateMany` dengan `where: { id, status: REQUEST }`) menutup race, mengikuti pola `EventRepository.updateStatusIf` (event.md §7). Untuk approve, conditional update ini jadi langkah pertama transaksi (§5.2.1).

#### 5.2.1 `POST /:id/approve` — alur transaksional (approve → insert `events` sebagai `DRAFT`)

**Wajib** dibungkus `prisma.$transaction` agar `Event` + relasi + update submission atomik. Urutan:

1. **Conditional update** `eventSubmission.updateMany({ where: { id, status: 'REQUEST' }, data: { status: 'APPROVED', reviewedBy, reviewedAt: now, adminNote? } })`. `count === 0` → **404** (row tidak ada) atau **409** (sudah final) — bedakan dengan `findUnique` bila perlu pesan akurat. Pola `updateStatusIf` (event.md §7).
2. **Resolve `Network` (find-or-create)** dari `submission.organiser` — **sebelum** membuat `Event`:
   - Cari: `networkRepository.findByNameInsensitive(organiser)` → `findFirst({ where: { name: { equals: organiser, mode: 'insensitive' } } })` (trim input terlebih dulu).
   - Bila ada → pakai `id`-nya; bila tidak → `create({ name: organiser, state: state?.name ?? null, country: country.name })`. Lihat [network.md §5](./network.md#5-repository--service) (`findOrCreateByName`). Panggil lewat `NetworkService` (modul `event-submission` mengimpor `NetworkModule`), **bukan** query Prisma lintas modul.
   - `Network.name` **tidak unik** (network.md §2) → match case-insensitive bisa memetakan dua nilai `organiser` berbeda ke org yang sama, dan typo membuat org duplikat. Dedupe/merge = backlog (§9.2).
3. **Buat `Event`**: `status='DRAFT'`, `publishedAt=null`, `visibility='PUBLIC'`, `createdBy=reviewer userId` (dari JWT), **`networkId = network.id`** (dari langkah 2). `content` & `slug` dari mapping di bawah. `approvedAt` dibiarkan `null` (audit "pertama terbit" di-set belakangan oleh alur publish).
4. **Buat relasi**: `EventDate` (satu baris per hari inklusif `startDate..endDate`, `startTime`/`endTime` null), `EventLocation` (satu baris), `AssignEventType` dari `eventTypeId`.
5. **Update submission** (sudah di langkah 1 sebagian): set `eventId = event.id` (via `updateMany` conditional atau bagian data langkah 1 setelah `Event` dibuat).
6. **Gagal di tengah → rollback**; submission tetap `REQUEST`, tidak ada `Event` yatim, tidak ada `Network` yatim (create org ikut rollback); balas **500** (error tak terduga).

> `ponytail:` langkah 1 bisa digabung ke dalam transaksi yang sama (bukan pre-check terpisah); `updateMany` conditional tetap penjaga race. Jangan bangun saga/outbox — satu transaksi DB cukup.

> **Publikasi setelah approve.** `Event` hasil approve berstatus `DRAFT`; **publikasi bukan bagian dari approve**. Admin mengeditnya lewat modul event existing (`PATCH /events/:id`) lalu mem-publish lewat alur publish yang sudah ada (`POST /events/:id/publish`, permission **`event:publish`**). Karena event sudah `DRAFT`, alur `event:submit`/`REQUEST` **dilewati** — tidak ada `POST /events/:id/submit` maupun status `REQUEST` di jalur ini. Event `DRAFT` hasil approve muncul di list `GET /events` internal (subject row-level scoping, event.md §7). Response approve mengembalikan `event.id` agar FE admin redirect ke `/events/:id/edit`. `publish` menerima `DRAFT → PUBLISHED` (jalur ini, admin bisa publish langsung setelah mengedit) **juga** `APPROVED → PUBLISHED` (legacy; baris `APPROVED` lama). Tidak ada transisi/endpoint baru: tetap action `publish` (`POST /events/:id/publish`, permission `event:publish`); non-admin (`member`/`author`) tidak punya `event:publish` → tidak ada eskalasi hak. `unpublish` tetap `PUBLISHED → DRAFT`, dan `approvedAt` tetap di-set `existing ?? now` saat publish. **RENCANA — belum ada di kode:** `EVENT_TRANSITIONS.publish` kini tercatat `from: [DRAFT, APPROVED]` (array) pada event.md §7.

**Tabel mapping field (submission → `Event`)**

| Submission | Event | Catatan |
| --- | --- | --- |
| `title` | `name` | langsung. |
| (auto) | `slug` | `slugify(title)` + sufiks unik (`event.md` `slug.util.ts`); bentrok → tambah `-2`, `-3`, dst. |
| `shortDescription` | `content` | HTML **di-escape**: `<p>{escape(shortDescription)}</p>`; `Event.content` wajib (non-null). `organiser` **tidak** lagi ditulis ke `content`. |
| `organiser` | `Network` (find-or-create) → `Event.networkId` | Cari `Network` dengan `name` sama (case-insensitive, trim) → pakai; bila tidak ada → `create { name: organiser, state: state?.name ?? null, country: country.name }`. Catatan: `Network.name` **tidak unik** → match case-insensitive bisa menunjuk org yang sama, typo membuat org duplikat (dedupe/merge = backlog). |
| `author` (`author_full_name`/`author_email`/`author_country_id`/`author_state_id`) | — | **Tidak** dipetakan: data pengirim tetap **audit-only** pada submission. Approve tidak menyalinnya ke `Event`. |
| `startDate..endDate` | `dates[]` | satu `EventDate` per hari inklusif, cap **31 hari** (§8 poin 8); `date` UTC midnight, `startTime`/`endTime` null. |
| `country` + `state` | `location` | `name = state?.name ?? country.name`; `address = "{state}, {country}"`; `lat`/`lng` = null. |
| `eventTypeId` | `eventTypes[]` | satu `AssignEventType`. |
| `thumbnail` | `thumbnail` | URL storage EGS (§8 poin 4). |
| `status` (`APPROVED`) | `status` | `DRAFT` + `publishedAt=null` + `visibility=PUBLIC`. Publish dilakukan admin via alur publish event existing (§5.2.1). |
| `reviewedBy` | `createdBy` | admin penyetuju (submission tak punya `User`). |

Keterbatasan & keputusan:

- `Event` **tidak punya kolom teks `organiser`** → organiser direpresentasikan sebagai relasi `Event.network` (hasil find-or-create saat approve, §5.2.1), bukan kolom string. Tampilan publik memakai `Event.network.name` (fallback `creator.network.name`/`creator.fullName` — lihat event.md §3/§4).
- `EventLocation.name` diisi **region** (`state?.name ?? country.name`) karena form publik tak punya nama venue; `lat`/`lng` null (bukan 0).
- **Idempotensi**: `EventSubmission.eventId @unique` (§2) + conditional update `status: REQUEST` → approve ganda tidak menghasilkan `Event` dobel.
- **Section `author` audit-only**: kolom `author_*` (§2) tidak disalin ke `Event` saat approve — hanya tersimpan sebagai jejak pengirim di submission. `author` wajib sejak migration `20260929160000_add_event_submission_author` (breaking untuk konsumen publik, §2).
- Tanggal di-cap 31 hari → approve tidak pernah membuat ratusan `EventDate` (§8 poin 8).

**Respons approve**: `{ data: { submission, event: { id, slug, status: 'DRAFT' } }, message }` — cukup rujukan, tidak meng-echo seluruh `Event`. `event.id` dipakai FE admin untuk redirect ke `/events/:id/edit`.

Contoh approve:

```http
POST /api/v1/event-submissions/3fa85f64-5717-4562-b3fc-2c963f66afa6/approve
Authorization: Bearer <jwt>

{ "adminNote": "Lokasi terverifikasi." }
```

```json
{
  "data": {
    "submission": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "status": "APPROVED",
      "eventId": "b7e2c1a0-...",
      "adminNote": "Lokasi terverifikasi.",
      "reviewedBy": "d290f1ee-...",
      "reviewedAt": "2026-09-27T08:00:00.000Z"
    },
    "event": { "id": "b7e2c1a0-...", "slug": "gamelan-workshop-amsterdam", "status": "DRAFT" }
  },
  "message": "success"
}
```

### 5.3 Kontrak List Admin (RULES bab 19/19a/19b)

Konstanta di-export dari `event-submission.service.ts`:

| Konstanta | Nilai |
| --- | --- |
| `EVENT_SUBMISSION_SEARCHABLE_FIELDS` | `['title', 'organiser']` |
| `EVENT_SUBMISSION_SORT_FIELDS` | `['title', 'status', 'startDate', 'createdAt', 'updatedAt']` |
| `EVENT_SUBMISSION_FILTER_FIELDS` | `['status', 'countryId', 'eventTypeId', 'createdAt', 'updatedAt']` |
| `EVENT_SUBMISSION_DATE_FIELDS` | `['startDate', 'endDate', 'reviewedAt', 'createdAt', 'updatedAt']` |
| `EVENT_SUBMISSION_NUMBER_FIELDS` | `['countryId', 'stateId']` |

- `search` di-trim; `<2 char` diabaikan (`buildSearch`); `>100 char` → 422.
- `sortBy` tak dikenal → 422 (`assertAllowedSort`). Default `sortBy=createdAt&sortOrder=desc`.
- `filter[status]=REQUEST` (enum), `filter[countryId]=153`, `filter[eventTypeId]=<uuid>`, `filter[createdAt][gte]=...`.
- `:id` pakai `ParseUUIDPipe`.

Contoh query & respons:

```
GET /api/v1/event-submissions?page=1&limit=20&sortBy=createdAt&sortOrder=desc&filter[status]=REQUEST&search=gamelan
```

```json
{
  "data": [
    { "id": "3fa85f64-...", "title": "Gamelan Workshop Amsterdam", "status": "REQUEST",
      "startDate": "2026-10-01T00:00:00.000Z", "endDate": "2026-10-02T00:00:00.000Z",
      "countryId": 153, "country": { "id": 153, "iso2": "NL", "name": "Netherlands" },
      "stateId": 2751, "state": { "id": 2751, "name": "North Holland" },
      "eventTypeId": "8f14e45f-...", "eventType": { "id": "8f14e45f-...", "name": "Workshop" },
      "organiser": "Gamelan Foundation NL",
      "author": { "fullName": "Budi Santoso", "email": "budi@example.com", "countryId": 101, "stateId": 5,
        "country": { "id": 101, "iso2": "ID", "name": "Indonesia" }, "state": null },
      "shortDescription": "Dua hari workshop gamelan untuk pemula.",
      "thumbnail": null, "createdAt": "2026-09-26T10:00:00.000Z", "updatedAt": "2026-09-26T10:00:00.000Z" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 },
  "message": "success"
}
```

---

## 6. Error & Exception

Format standar: `{ statusCode, message, errors }` (RULES bab 5).

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `POST /event-submissions` | `UnprocessableEntityException` | 422 | validasi DTO per-field, `endDate < startDate`, durasi > 31 hari (§8.8), `countryId`/`stateId`/`eventTypeId` relasi tidak valid, `thumbnail` bukan milik storage EGS (§8.4) |
| `POST /event-submissions` | `ConflictException` | 409 | duplikat identik (`title`+`startDate`+`countryId`) dalam window singkat (§8.7) |
| `POST /event-submissions/thumbnail` | `UnprocessableEntityException` | 422 | `files` kosong/hilang / >10 file / MIME tak didukung / file terlalu besar (dari `MulterUploadManyInterceptor` + `ImageService`) |
| `GET /event-submissions` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, enum/tanggal invalid |
| `GET /event-submissions/:id` | `BadRequestException` | 400 | `:id` bukan UUID (`ParseUUIDPipe`) |
| `GET /event-submissions/:id` | `NotFoundException` | 404 | submission tidak ada |
| `POST /:id/approve`, `/:id/reject` | `ConflictException` | 409 | row sudah final (`APPROVED`/`REJECTED`) — `Cannot <action> event submission in status <STATUS>` |
| `POST /:id/approve`, `/:id/reject` | `NotFoundException` | 404 | submission tidak ada |
| `POST /:id/approve` | `InternalServerErrorException` | 500 | gagal saat transaksi insert `Event` `DRAFT` → rollback, submission tetap `REQUEST` (§5.2.1) |
| admin endpoints | `UnauthorizedException` / `ForbiddenException` | 401 / 403 | JWT invalid / permission kurang |
| `POST /event-submissions` (create saja) | `HttpException` (429) | 429 | rate limit 5/menit terlampaui (§8); `POST /event-submissions/thumbnail` **tidak** di-throttle, `GET /event-types` juga tidak |

Contoh 409:

```json
{ "statusCode": 409, "message": "Cannot approve event submission in status APPROVED", "errors": [] }
```

---

## 7. Permission

Seed di `libs/prisma/seed.ts` (`DEFAULT_PERMISSIONS`, rujuk [rbac.md §7](./rbac.md#7-seed-default)). Konvensi `resource:action` lowercase (rbac.md §4).

| Code | Deskripsi | admin | member |
| --- | --- | :---: | :---: |
| `event-submission:read` | Lihat daftar/detail usulan | ✅ | — |
| `event-submission:approve` | Setujui + recreate konten ke tabel `events` sebagai `DRAFT` (bukan publish) | ✅ | — |
| `event-submission:reject` | Tolak usulan | ✅ | — |

- Seed **3** code `event-submission:*`, semuanya **admin-only**.
- `admin` otomatis mendapat semua code (`DEFAULT_PERMISSIONS.map`).
- Endpoint publik (`POST /event-submissions`, `POST /event-submissions/thumbnail`, `GET /event-types`) tetap `@Public()` → **bypass deny-by-default**, jadi **tidak butuh** permission apa pun (§5.1). Submit publik murni anonim — tidak ada permission `create`.
- Update hitungan `DEFAULT_PERMISSIONS` di `rbac.md` §7 (**62 → 65**, +3; total seed kini **65** termasuk `archive:*` 9). `pnpm prisma:seed` idempoten.

---

## 8. Keamanan & Anti-Spam

**Rencana.** Endpoint tulis publik tanpa auth = permukaan serangan terbuka. Rencana pertahanan konkret (per poin, wajib ditandai saat implementasi):

1. **Rate limit** — `@nestjs/throttler` terpasang + `ThrottlerModule` (global) di `app.module.ts`. `POST /event-submissions` **5/menit per-IP** via `@UseGuards(ThrottlerGuard)` + `@Throttle`. **Wajib** `app.set('trust proxy', 1)` di bootstrap (Express) agar IP benar di belakang reverse proxy; tanpa ini semua request terlihat dari IP proxy → throttle per-IP bocor.
   - **`POST /event-submissions/thumbnail` TIDAK di-throttle — keputusan sadar.** Throttle upload dibatalkan agar form eksternal (EGS) tidak terkena `429` saat mengunggah beberapa gambar berurutan; kompensasinya endpoint kini multi-file dengan batas keras **10 file/request** (`MulterUploadManyInterceptor`, `MAX_UPLOAD_FILES`). **Risiko residual:** anonim bisa mengirim banyak request berisi 10 gambar (masing-masing ≤ `UPLOAD_MAX_SIZE_MB`) → biaya storage/CPU `sharp`. **Upgrade path** bila disalahgunakan: pasang kembali `@Throttle({ default: { limit: 10, ttl: 60_000 } })` (mode lama) **atau** kuota per-IP/hari di level proxy/WAF — tanpa mengubah kontrak request (tetap `files`, maks 10).
   - **Upload multi-file TIDAK atomik.** Setiap file diunggah independen lewat `ImageService.upload`; bila file ke-N gagal (**422**/500), file 1..N-1 dalam request yang sama **sudah tersimpan** dan bisa menjadi **orphan** (`entityId=null`) — `POST /event-submissions` hanya menautkan satu URL, jadi sisanya tidak pernah dirujuk. **Upgrade path:** cleanup per-file saat gagal (hapus objek yang sudah terunggah), atau unggah sekuensial + rollback.
   - `GET /event-types` tidak dibatasi.
2. **Validasi ketat** — global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. DTO pakai `@MaxLength` (§4). Set **body JSON limit** ketat untuk route publik (mis. **64–100 kb**; route lain bisa default). `forbidNonWhitelisted` menolak field asing → `status`/`reviewedBy`/`eventId` **tidak bisa disuntik** dari body; server yang menentukannya.
3. **Upload hardening** — pertahankan MIME allowlist + size cap (`UPLOAD_MAX_SIZE_MB`), **tambah**: sniff **magic bytes** (bukan cuma header `Content-Type` yang bisa dipalsukan), **tolak SVG** (XSS), **re-encode/downscale** lewat `ImageProcessor` (strip EXIF + normalisasi format), key acak UUID (sudah), `entityType` **di-hardcode server-side** (`'event-submission'`, jangan dari body).
4. **Thumbnail URL trust** — `POST /event-submissions` hanya menerima URL milik storage EGS: cek `thumbnail` cocok prefix `S3_PUBLIC_BASE_URL` **DAN** ada baris `Image` dengan `entityType='event-submission'` & `entityId=null` (hasil upload yang belum ditautkan). Selain itu → **422** `thumbnail must reference an uploaded EGS image`. Cegah SSRF/hotlink ke domain asing.
5. **CORS** — origin **allowlist dari env** (domain website EGS), bukan `*`; `credentials: false` untuk route publik (tanpa cookie).
6. **Bot mitigation** — honeypot tersembunyi (mis. field `website` harus kosong) → bila terisi, tolak. Rekomendasi captcha (**Cloudflare Turnstile**) sebagai **opsional**: bila diaktifkan, verifikasi token di **controller/service** (bukan DTO), env untuk secret; jangan log token.
7. **Anti-duplikat/abuse** — tolak duplikat identik (`title` + `startDate` + `countryId`) dalam window singkat (mis. **10 menit**) → **409** (atau 422). Opsional cap per-IP/hari.
8. **DoS tanggal** — batasi rentang `endDate - startDate` maksimum (mis. **31 hari**) → **422**, agar approve tidak membuat ratusan `EventDate` (§5.2.1).
9. **Anti stored-XSS** — `shortDescription` di-**escape** saat dipetakan ke `Event.content` (HTML, §5.2.1); `organiser` tidak ditulis ke HTML pada approve, dan bila dirender FE wajib di-escape juga. Output publik tidak boleh menjalankan script.
10. **Privasi/GDPR (Eropa)** — simpan data minimum; bila IP disimpan untuk anti-abuse, simpan **hash** (bukan mentah) dan sebut retensi/log. Jangan simpan PII yang tak perlu.
11. **No info leak** — respons `POST` publik hanya `{ id, status }` (§5.1), **jangan** echo row/PII. Error generik, **tanpa stack trace**.
12. **Approve path** — tetap butuh permission `event-submission:approve`; **membuat `Event` `DRAFT`** (bukan publish) di dalam transaksi `prisma.$transaction` (§5.2.1); gagal → rollback. Publikasi berikutnya memakai permission `event:publish` milik modul event.
13. **Anti org spam** — row `Network` **hanya** dibuat lewat approve (admin/moderator), **bukan** dari `POST /event-submissions` publik. Input publik belum termoderasi, jadi tidak boleh membuat entitas `Network`; `organiser` disimpan sebagai string sampai approve (find-or-create, §5.2.1).

Semua poin di atas **bagian rencana**, belum ada kode. Bila throttler/captcha ditunda, catat sebagai risiko sampai terpasang.

---

## 9. Catatan

### 9.1 Perubahan file existing yang perlu diimplementasikan

| # | File | Perubahan |
| --- | --- | --- |
| 1 | `libs/prisma/schema.prisma` | enum `EventSubmissionStatus`, model `EventSubmission` (+ `eventId` relasi ke `Event`), back-relation `Country.eventSubmissions` / `State.eventSubmissions` / `EventType.eventSubmissions` / `Event.submission`; **plus** `Event.networkId` (nullable) + relasi `Event.network` + back-relation `Network.events` (dipakai approve §5.2.1). |
| 1a | `libs/src/modules/network/` | tambah `findByNameInsensitive`/`findOrCreateByName` (network.md §5); `libs/src/modules/event-submission/event-submission.module.ts` impor `NetworkModule`. |
| 2 | `apps/app/src/controllers/event-types.controller.ts` | `@Get()` dari `@Permissions('event-type:read')` → `@Public()` (dropdown form publik). |
| 3 | `libs/src/modules/image/dto/upload-image.dto.ts` | `@IsIn(['post', 'event', 'event-submission'])`. |
| 4 | `libs/prisma/seed.ts` | **3** permission `event-submission:read/approve/reject` ke `DEFAULT_PERMISSIONS`, ketiganya **admin-only**. Jalankan `pnpm prisma:seed`. |
| 5 | `libs/src/libs.module.ts` | daftar `EventSubmissionModule` (imports/exports). |
| 6 | `apps/app/src/app.module.ts` | daftar `EventSubmissionsController`. |
| 7 | `backend/docs/modules/rbac.md` §7 | update hitungan `DEFAULT_PERMISSIONS` (62 → 65, +3); ketiga code `event-submission:*` admin-only. |
| 8 | `libs/src/common/interceptors/multer-upload.interceptor.ts` | Tambah `MulterUploadManyInterceptor` (+ `MAX_UPLOAD_FILES = 10`, opsi multer & MIME filter bersama, `requireUploadedFiles`). `MulterUploadInterceptor` (single `file`) tidak berubah. **BREAKING** API publik: `POST /event-submissions/thumbnail` kini field `files` (maks 10) → respons `ImageResponse[]`, dan **tidak lagi di-throttle**. |

Perintah: `pnpm prisma migrate dev --name add_event_submissions` → `pnpm prisma:generate` → `pnpm prisma:seed` → `pnpm tsc --noEmit` → `pnpm lint` (AGENTS.md Verifikasi).

### 9.2 Konversi ke `Event` — **termasuk iterasi ini**

Approve **membuat `Event` `DRAFT`** (§5.2.1), **bukan publish**. Setelah approve, submission **tidak dihapus** — tetap tersimpan sebagai audit (`status=APPROVED`, `eventId` terisi). Admin mengedit event hasil approve lalu mem-publish lewat alur publish modul event existing (`POST /events/:id/publish`, permission `event:publish`); alur `event:submit`/`REQUEST` **dilewati** karena event sudah `DRAFT`. Mapping, alur transaksional, dan cap 31 hari ada di §5.2.1. Keputusan lama "konversi = backlog fase 2" **dibatalkan**.

Backlog terpisah (di luar iterasi ini, tambah saat ada kebutuhan nyata):

- **Merge/dedupe `Network` by name** — find-or-create case-insensitive (§5.2.1) bisa membuat org duplikat (typo/varian nama). Tambah tool merge saat data mulai kotor.
- **Endpoint publik `/events`** — public read (`visibility=PUBLIC` & `status=PUBLISHED`) untuk website EGS menampilkan event, bila belum ada. `ponytail:` jangan bangun sebelum ada konsumen.

### 9.3 Keputusan desain

- Tabel terpisah (`event_submissions`) — submission bukan `Event` sampai **disetujui**; saat approve dibuat `Event` `DRAFT` dan ditautkan `eventId` (§5.2). Submission tetap tersimpan sebagai audit.
- `eventTypeId` **wajib** di DTO meski di model nullable (legacy/flexibility), memudahkan validasi form publik.
- `reviewedBy` scalar tanpa relasi `User` — audit ringan; tambah relasi bila perlu menampilkan reviewer. Dipakai juga sebagai `Event.createdBy` saat approve.
- `stateId` wajib se-negara dengan `countryId` — cegah data geo tidak konsisten.
- Status final tidak bisa diubah → 409 (bukan overwrite) — conditional update + `eventId @unique` menjaga audit trail & idempotensi approve.
- Endpoint publik tetap `@Public()` tanpa permission; 3 permission `event-submission:*` (`read`/`approve`/`reject`) tetap di-seed, **admin-only** (§7). Submit publik murni anonim tanpa permission tambahan.
- `organiser` publik tetap `String` di submission; `Network` dibuat hanya saat approve (bukan saat submit) — cegah org spam dari input tak termoderasi (§2, §8 poin 13).
- **Upload thumbnail multi-file** — field multipart `files` (array, 1–10; `MAX_UPLOAD_FILES`), satu `ImageResponse` per file. Upload **tidak** di-throttle; batas abuse = 10 file/request (§8 poin 1). Konsumen memakai item pertama sebagai `thumbnail`.
- **Dashboard admin = konsumen list admin, tanpa endpoint baru.** Semua submission (publik anonim) muncul di sini. UI memakai `GET /event-submissions?filter[status]=REQUEST`; tidak ada endpoint `stats`/`dashboard` baru. **Count dibaca dari `meta.total`**. Bila caching/agregasi count dibutuhkan, itu backlog terpisah (belum ada).
