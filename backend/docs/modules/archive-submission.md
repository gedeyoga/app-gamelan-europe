# Module: Archive Submission

Menu: [archive.md](./archive.md) (resource tujuan) · [event.md](./event.md) (pola acuan) · [rbac.md](./rbac.md) (master) · sibling FE: `frontend/docs/module/archive-submission.md`

> **STATUS: RENCANA — BELUM DIIMPLEMENTASIKAN.** Dokumen ini menggantikan desain lama (tabel terpisah `archive_submissions` + endpoint admin `approve`/`reject`). Desain baru **mengikuti flow event-submission pasca migrasi `20261006120000_drop_submissions_add_content_source`**: submit publik **tulis langsung ke tabel utama `archives`** (`status=REQUEST`, `source=PUBLIC`), **tanpa tabel terpisah**. Tidak ada `schema.prisma` change, DTO `CreatePublicArchiveDto`, method `ArchiveService.createPublicSubmission`, maupun migration untuk desain ini saat dokumen ditulis. Semua isi bersifat **spesifikasi final yang akan diimplementasikan**. **Dokumen ini hanya brief — tidak ada kode yang diubah.**

---

## 1. Deskripsi & Lokasi

Fitur **Archive Submission**: orang di luar EGS (tanpa akun) mengusulkan archive lewat form publik website EGS. Sama seperti `event-submission`/`story-submission`, backend **menulis langsung** ke tabel utama `archives` dengan `status=REQUEST` + `source=PUBLIC` (lihat [event.md §7](./event.md#7-create-public-submission)). **Tidak ada tabel `archive_submissions`**, tidak ada endpoint admin approve/reject khusus submission.

Admin meninjau memakai **list archive biasa**: `GET /archives?filter[status]=REQUEST`, lalu `POST /archives/:id/approve` (`REQUEST → PUBLISHED`) atau `POST /archives/:id/reject` (`REQUEST → DRAFT`) yang **sudah ada** ([archive.md §5](./archive.md#5-aturan-status)). Submit publik tidak punya jalur tulis selain `POST /archive-submissions` (yang menerjemah ke `archives` di server).

Karakteristik:

- **Satu jalur: publik anonim** — `POST /archive-submissions` (`@Public()`), memakai `CreatePublicArchiveDto`, menghasilkan baris `Archive` `status=REQUEST`, `source=PUBLIC`, `type=PUBLIC`.
- **Tanpa autentikasi** untuk ketiga endpoint publik (`POST /archive-submissions`, `.../thumbnail`, `.../attachments`).
- **Tulis langsung ke `archives`** — `ArchiveRepository.create` dipanggil langsung (BYPASS `ArchiveService.create` yang me-resolve access scope & menolak user publik).
- **Audit submitter lewat `User`** — data pengirim di-`findOrCreatePublicUser` (dipakai sebagai `createdBy` + author), **tidak** disimpan mentah sebagai JSON.
- Field tambahan untuk memetakan input EGS: `materialType`, `date`, `author`, `organisation`, `countryId`, `stateId` (kolom baru di `Archive`, §2).
- Thumbnail disimpan sebagai URL hasil `POST /archive-submissions/thumbnail`. PDF disimpan sebagai baris `Document` (`entityType='archive'`, `entityId=null`) dan id-nya dikirim di `attachments` → menjadi `Archive.documentIds`.

### Lokasi kode (rencana)

```
libs/src/modules/archive/
├── archive.repository.ts          ← tambah field ke CreateArchiveData; expose kolom baru di archiveSelect
├── archive.service.ts             ← tambah createPublicSubmission()
├── archive.module.ts              ← tambah provider yang dibutuhkan
├── dto/
│   ├── create-archive.dto.ts
│   ├── create-public-archive.dto.ts   ← BARU (mirror create-public-event.dto.ts)
│   ├── update-archive.dto.ts
│   └── list-archives-query.dto.ts
└── entities/
    └── archive.entity.ts          ← expose kolom baru di archiveSelect

apps/app/src/controllers/
└── archive-submissions.controller.ts   ← tetap ada, HANYA 3 endpoint publik (GET/approve/reject DIHAPUS)
```

Alur baku `Controller → Service → Repository → Prisma`; repository satu-satunya tempat query Prisma (RULES bab 3).

Perubahan file existing (rencana):

| File | Perubahan |
| --- | --- |
| `libs/prisma/schema.prisma` | tambah kolom `Archive`: `source ContentSource @default(REGISTERED)`, `date DateTime?`, `author String?`, `organisation String?`, `countryId Int?`, `stateId Int?`, `materialType ArchiveMaterialType?`; **hapus** `model ArchiveSubmission`, `enum ArchiveSubmissionStatus`, back-relation `Archive.submission`. Migration baru `drop_archive_submissions_add_archive_public_source` (§2). |
| `libs/src/modules/archive/dto/create-public-archive.dto.ts` | **BARU** — `CreatePublicArchiveDto` + nested submitter (§4). |
| `libs/src/modules/archive/archive.service.ts` | tambah `createPublicSubmission()` (§5). Inject `UserService`, `CountryRepository`, `StateRepository`, `CategoryService`, `ImageService`, `DocumentRepository`. |
| `libs/src/modules/archive/archive.repository.ts` | tambah `source`, `date`, `author`, `organisation`, `countryId`, `stateId`, `materialType` ke `CreateArchiveData` + cabang `create`/`update`. |
| `libs/src/modules/archive/entities/archive.entity.ts` | `archiveSelect` expose kolom baru. |
| `libs/src/modules/archive/archive.module.ts` | daftarkan provider yang diimpor (mirror `EventModule`). |
| `apps/app/src/controllers/archive-submissions.controller.ts` | hapus `GET /`, `GET /:id`, `POST /:id/approve`, `POST /:id/reject`; sisakan 3 endpoint publik; `entityType` thumbnail/attachment di-hardcode `'archive'`; buang `ArchiveSubmissionService`. |
| `libs/src/modules/archive-submission/` | **HAPUS seluruh folder** (module, repository, service, dto, entities). |
| `libs/src/libs.module.ts` | hapus import + registrasi `ArchiveSubmissionModule` (baris 29, 66, 97). |
| `apps/app/src/app.module.ts` | buang `ArchiveSubmissionService` dari DI controller; `ArchiveSubmissionsController` tetap terdaftar (baris 38, 83). |
| `libs/src/index.ts` | hapus 7 `export *` `./modules/archive-submission/*` (baris 154–160). |
| `libs/src/modules/image/dto/upload-image.dto.ts` | pastikan `'archive'` ada di `@IsIn`; hapus `'archive-submission'` (baris 6). |
| `libs/prisma/seed-data.ts` | hapus **3** permission `archive-submission:*` (baris 74–76). Update `rbac.md` §7 (70 → 67, §8). |
| `libs/prisma/schema.prisma` (enum) | `ArchiveMaterialType` **dipertahankan** (dipakai `Archive.materialType` + map kategori); hanya `ArchiveSubmissionStatus` yang dihapus. |
| env | pakai ulang `UPLOAD_DOCUMENT_MAX_SIZE_MB` (default `10`) untuk attachment publik — **tidak ada env baru**. |

---

## 2. Model Prisma & Migration

### 2.1 Kolom baru pada `Archive`

Tambah ke `model Archive` di `libs/prisma/schema.prisma` (satu-satunya sumber entity, RULES bab 4):

```prisma
model Archive {
  // ... kolom existing ...
  source        ContentSource        @default(REGISTERED)   // mirror Event/Post: PUBLIC = submit anonim
  // Pemetaan field EGS tanpa padanan langsung (material/informasi submission publik):
  date          DateTime?            // material date; EGS kirim `YYYY-MM-DD`
  author        String?              // free text (bukan User)
  organisation  String?              // free text (bukan Network)
  countryId     Int?                 @map("country_id")     // scalar, validasi di service (tanpa relasi)
  stateId       Int?                 @map("state_id")       // scalar, validasi di service (tanpa relasi)
  materialType  ArchiveMaterialType? @map("material_type")  // traceability; kategori tetap dibuat (Category type=ARCHIVE)
  // ... relasi existing ...
}
```

Catatan:

- `source ContentSource @default(REGISTERED)` → baris existing tetap `REGISTERED`; submit publik menulis `PUBLIC` (mirror `Event`/`Post`).
- `date`/`author`/`organisation`/`countryId`/`stateId`/`materialType` **nullable** (archive internal tidak mengisinya). Kolom geo **scalar tanpa relasi** — validasi keberadaan/relasi di service → 422; disimpan hanya untuk traceability.
- `materialType` → kolom + pembuatan `Category` `type=ARCHIVE` (label enum) → `ArchiveCategory`. Kategori dibuat idempoten by `name`+`type` via `CategoryService.create`.
- `ContentSource`, `ArchiveMaterialType`, `ArchiveType`, `ArchiveStatus` sudah ada di schema — **tidak ada enum baru**.

### 2.2 Yang DIHAPUS

```prisma
// HAPUS: model ArchiveSubmission { ... }
// HAPUS: enum ArchiveSubmissionStatus { REQUEST APPROVED REJECTED }
// HAPUS baris back-relation pada model Archive:  submission ArchiveSubmission?
```

### 2.3 Migration

Satu migration baru, usul nama **`drop_archive_submissions_add_archive_public_source`**:

```bash
# libs/prisma/migrations/<timestamp>_drop_archive_submissions_add_archive_public_source/migration.sql
#   DROP TABLE "archive_submissions";
#   DROP TYPE "ArchiveSubmissionStatus";
#   ALTER TABLE "archives" ADD COLUMN "source" "ContentSource" NOT NULL DEFAULT 'REGISTERED';
#   ALTER TABLE "archives" ADD COLUMN "date" TIMESTAMP(3);
#   ALTER TABLE "archives" ADD COLUMN "author" TEXT;
#   ALTER TABLE "archives" ADD COLUMN "organisation" TEXT;
#   ALTER TABLE "archives" ADD COLUMN "country_id" INTEGER;
#   ALTER TABLE "archives" ADD COLUMN "state_id" INTEGER;
#   ALTER TABLE "archives" ADD COLUMN "material_type" "ArchiveMaterialType";

pnpm prisma migrate dev --name drop_archive_submissions_add_archive_public_source
pnpm prisma:generate
pnpm prisma:seed
```

> `ArchiveSubmissionStatus` hanya dipakai `ArchiveSubmission` → aman dihapus bersama tabelnya. `ArchiveMaterialType` **tidak** dihapus (dipakai kolom baru).

---

## 3. Entity Payload

`archiveSelect` di `libs/src/modules/archive/entities/archive.entity.ts` **tambah** kolom baru agar ikut ter-select (tidak ada payload type baru; `ArchiveEntity`/`ArchiveListItem`/`ArchiveResponse` existing menampungnya otomatis):

```typescript
export const archiveSelect = {
  id: true,
  name: true,
  description: true,
  thumbnail: true,
  type: true,
  status: true,
  source: true,        // BARU
  publishedAt: true,
  approvedAt: true,
  externalLinks: true,
  documentIds: true,
  date: true,          // BARU
  author: true,        // BARU
  organisation: true,  // BARU
  countryId: true,     // BARU (scalar, tanpa relasi)
  stateId: true,       // BARU (scalar, tanpa relasi)
  materialType: true,  // BARU
  creator: { select: { id: true, fullName: true, networkId: true } },
  categories: { select: { category: { select: { id: true, name: true, type: true } } } },
  authors: { select: { /* existing */ } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArchiveSelect;
```

- Tidak ada `ArchiveSubmission*` payload type (folder dihapus).
- Item list `ArchiveListItem` tetap (tanpa `documentIds`/`documents`); `documents` hanya pada detail (`ArchiveResponse`) via `hydrate` (§ [archive.md §3](./archive.md#3-entity-payload-type)).

---

## 4. DTO

### `CreatePublicArchiveDto`

File: `libs/src/modules/archive/dto/create-public-archive.dto.ts`. **Mirror `CreatePublicEventDto`** (`libs/src/modules/event/dto/create-public-event.dto.ts`) — nested submitter + `forbidNonWhitelisted`.

```typescript
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsNotEmpty,
  IsNotEmptyObject, IsOptional, IsString, IsUrl, IsUUID, MaxLength,
  ValidateNested,
} from 'class-validator';
import { ArchiveMaterialType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Section "Submitted By" — dipakai `findOrCreatePublicUser`. Cross-field `submitter.stateId`
// milik `submitter.countryId` dicek di service → 422 `submitter.stateId`.
export class PublicArchiveSubmitterDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) fullName: string;
  @Transform(trimLower) @IsEmail() @MaxLength(200) email: string;
  @Type(() => Number) @IsInt() countryId: number;
  @IsOptional() @Type(() => Number) @IsInt() stateId?: number;
}

export class CreatePublicArchiveDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(2048) thumbnail?: string;
  @IsOptional() @IsArray() @IsUrl({}, { each: true }) @ArrayMaxSize(50) externalLinks?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) @ArrayMaxSize(20) attachments?: string[];
  @IsOptional() @IsEnum(ArchiveMaterialType) materialType?: ArchiveMaterialType;
  @IsOptional() @IsDateString() date?: string;            // ISO `YYYY-MM-DD`
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) author?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) organisation?: string;
  @IsOptional() @Type(() => Number) @IsInt() countryId?: number;
  @IsOptional() @Type(() => Number) @IsInt() stateId?: number;
  @IsNotEmptyObject() @ValidateNested() @Type(() => PublicArchiveSubmitterDto) submitter: PublicArchiveSubmitterDto;
}
```

| Field | Aturan |
| --- | --- |
| `name` | wajib, trim, `@IsNotEmpty`, `@MaxLength(200)` |
| `description` | opsional, `@MaxLength(500)` (teks biasa) |
| `thumbnail` | opsional, `@MaxLength(2048)` (URL EGS) |
| `externalLinks` | opsional, `@IsUrl({}, { each: true })`, `@ArrayMaxSize(50)` |
| `attachments` | opsional, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(20)`; id baris `Document` (`entityType='archive'`, `entityId=null`) → service validasi (§5) |
| `materialType` | opsional, `@IsEnum(ArchiveMaterialType)` |
| `date` | opsional, `@IsDateString()`; EGS kirim `YYYY-MM-DD` |
| `author` | opsional, `@MaxLength(200)` |
| `organisation` | opsional, `@MaxLength(200)` |
| `countryId` / `stateId` | opsional `@IsInt`; service cek ada + `stateId` milik `countryId` |
| `submitter` | wajib, nested (`fullName`, `email`, `countryId` wajib, `stateId?`) |

> `forbidNonWhitelisted` global **menolak** (`422`) field asing seperti `status`, `source`, `type`, `categoryIds`, `documentIds`, `createdBy`, `publishedAt`. Server yang menetapkannya.

### Hapus DTO lama

Hapus `create-archive-submission.dto.ts`, `review-archive-submission.dto.ts`, `list-archive-submissions-query.dto.ts` (folder `archive-submission/`).

### Contoh payload request

```json
{
  "name": "Gamelan 1970s Recordings",
  "description": "Field recordings archive.",
  "thumbnail": "https://cdn.example.com/posts/original/abc.jpg",
  "externalLinks": ["https://contoh.org/recordings"],
  "attachments": ["9c1d2e3f-0000-1111-2222-333344445555"],
  "materialType": "DOCUMENTARIES",
  "date": "1974-05-01",
  "author": "J. Doe",
  "organisation": "European Gamelan Society",
  "countryId": 1,
  "stateId": 12,
  "submitter": { "fullName": "J. Doe", "email": "jane@example.com", "countryId": 1, "stateId": 12 }
}
```

### Contoh 422

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    { "field": "name", "message": "name should not be empty" },
    { "field": "attachments.0", "message": "attachment not found, wrong type, or already bound" },
    { "field": "submitter.stateId", "message": "submitter.stateId must belong to submitter.countryId" }
  ]
}
```

---

## 5. Endpoint & Service

Semua path prefix **`/api/v1`** (RULES bab 1). Sukses `{ data, message }`; error `{ statusCode, message, errors }`.

### 5.1 PUBLIK (`@Public()`, tanpa RBAC)

**`@Public()` = bypass penuh deny-by-default** ([rbac.md §6](./rbac.md#6-authorization-deny-by-default)). Jangan tambah `@Permissions` di sini.

| Method | Path | Throttle | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/archive-submissions` | 5/menit | `CreatePublicArchiveDto` (JSON) | 201 `{ data: { id, status: "REQUEST" }, message }` |
| POST | `/api/v1/archive-submissions/thumbnail` | 10/menit | multipart `file` | 201 `{ data: ImageResponse, message }` |
| POST | `/api/v1/archive-submissions/attachments` | 10/menit | multipart `file` (`application/pdf`) | 201 `{ data: DocumentResponse, message }` |

- `POST /archive-submissions` → `ArchiveService.createPublicSubmission(dto)` (§5.2). Respons **hanya** `{ id, status }` (tanpa echo row/PII).
- `POST .../thumbnail` → `@UseInterceptors(MulterUploadInterceptor)` + `@UploadedFile()`; `ImageService.upload(file, 'archive')` — `entityType` **di-hardcode server-side**. `'archive'` wajib ada di `@IsIn` `UploadImageDto`.
- `POST .../attachments` → `@UseInterceptors(DocumentUploadInterceptor)` + `@UploadedFile()`; `DocumentService.upload(file, 'archive')` — PDF-only + magic-byte `%PDF-` + max `UPLOAD_DOCUMENT_MAX_SIZE_MB`. `DocumentResponse = { id, url, key, filename, mimeType, size }`.

Contoh respons 201:

```json
{ "data": { "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "status": "REQUEST" }, "message": "success" }
```

### 5.2 `ArchiveService.createPublicSubmission(dto)` — mirror `EventService.createPublicSubmission`

Referensi persis: `libs/src/modules/event/event.service.ts` baris ~405–508.

Urutan:

1. **Validasi geo** → 422 per-field: `countryId` ada (`CountryRepository.findByIdOrNull`); `stateId` (bila ada) milik `countryId` (`StateRepository.findByIdOrNull`).
2. **Validasi submitter geo** → 422: `submitter.countryId` ada; `submitter.stateId` (bila ada) milik `submitter.countryId`.
3. **Validasi attachment** (bila ada) → tiap id = baris `Document` `entityType='archive'` & `entityId=null`. Reuse `ArchiveService.assertDocuments(dto.attachments, null)`; melanggar → **422** `attachments.N`.
4. **Thumbnail trust** (bila ada) → `imageService.isTrustedUnboundUrl(dto.thumbnail, 'archive')`; gagal → 422.
5. **Submitter → User**: `userService.findOrCreatePublicUser({ fullName, email, countryId: submitterCountry.iso2, stateId: submitter.stateId ?? null })`.
6. **Material type → kategori** (bila ada): `categoryService.create({ name: LABEL, type: CategoryType.ARCHIVE })` (idempoten by name+type) → `categoryIds: [category.id]`. Label enum→nama: `TUTORIALS→Tutorials`, `DOCUMENTARIES→Documentaries`, `RESEARCH→Research`, `DOCUMENTS→Documents`, `HISTORY→History`.
7. **Tulis langsung** — bangun `CreateArchiveData` & panggil `archiveRepository.create(data)` (**BUKAN** `ArchiveService.create`, yang menolak user publik via scope):
   - `name`, `description`, `thumbnail`, `externalLinks ?? []`, `documentIds: attachments ?? []`, `type: ArchiveType.PUBLIC`, `status: ArchiveStatus.REQUEST`, `source: ContentSource.PUBLIC`, `createdBy: user.id`, `authorIds: [user.id]`, `categoryIds`, + kolom baru (`date`, `author`, `organisation`, `countryId`, `stateId`, `materialType`).
   - `date` dikonversi `new Date(dto.date)` bila ada.
8. **Respons**: `{ id, status }` (tanpa echo row/PII).

```typescript
// libs/src/modules/archive/archive.service.ts (sketsa)
async createPublicSubmission(dto: CreatePublicArchiveDto): Promise<{ id: string; status: ArchiveStatus }> {
  // (1) geo + (2) submitter geo + (3) attachments + (4) thumbnail — 422 per-field, mirror event.service.
  const submitterUser = await this.userService.findOrCreatePublicUser({
    fullName: dto.submitter.fullName,
    email: dto.submitter.email,
    countryId: submitterCountry.iso2,
    stateId: dto.submitter.stateId ?? null,
  });
  let categoryIds: string[] | undefined;
  if (dto.materialType) {
    const category = await this.categoryService.create({
      name: ARCHIVE_MATERIAL_CATEGORY_LABELS[dto.materialType],
      type: CategoryType.ARCHIVE,
    });
    categoryIds = [category.id];
  }
  const archive = await this.archiveRepository.create({
    name: dto.name,
    description: dto.description,
    thumbnail: dto.thumbnail,
    externalLinks: dto.externalLinks ?? [],
    documentIds: dto.attachments ?? [],
    type: ArchiveType.PUBLIC,
    status: ArchiveStatus.REQUEST,
    source: ContentSource.PUBLIC,
    createdBy: submitterUser.id,
    authorIds: [submitterUser.id],
    categoryIds,
    date: dto.date ? new Date(dto.date) : undefined,
    author: dto.author,
    organisation: dto.organisation,
    countryId: dto.countryId,
    stateId: dto.stateId,
    materialType: dto.materialType,
  });
  return { id: archive.id, status: archive.status };
}
```

> `assertDocuments` saat ini meng-hardcode field `documentIds.N` & `entityType==='archive'`. Karena upload publik kini juga `entityType='archive'`, validasi cocok; **field error** perlu diparameterisasi agar keluar `attachments.N` (atau service memetakan pesan). Perubahan kecil & additive.

> Karena `archiveRepository.create` memanggil `DocumentRepository.bind(documentIds, 'archive', id)`, PDF publik otomatis ter-bind saat submit (bukan saat approve lagi).

### 5.3 ADMIN — tidak ada endpoint baru

| Method | Path | Permission | Catatan |
| --- | --- | --- | --- |
| GET | `/api/v1/archives?filter[status]=REQUEST` | `archive:read` | Dashboard review admin (list biasa). Count dari `meta.total`. |
| POST | `/api/v1/archives/:id/approve` | `archive:approve` | `REQUEST → PUBLISHED` ([archive.md §5](./archive.md#5-aturan-status)). |
| POST | `/api/v1/archives/:id/reject` | `archive:reject` | `REQUEST → DRAFT` ([archive.md §5](./archive.md#5-aturan-status)). |

Controller yang dihapus: `GET /archive-submissions`, `GET /archive-submissions/:id`, `POST /archive-submissions/:id/approve`, `POST /archive-submissions/:id/reject`.

---

## 6. Mapping Field EGS → `Archive`

| Field EGS | Tujuan | Catatan |
| --- | --- | --- |
| `name` | `Archive.name` | langsung. |
| `description` | `Archive.description` | teks biasa (bukan HTML). |
| `thumbnail` | `Archive.thumbnail` | URL storage EGS (`POST .../thumbnail`). |
| `externalLinks[]` | `Archive.externalLinks` | disalin apa adanya (urut). |
| `attachments[]` | `Archive.documentIds` | id baris `Document` (`entityType='archive'`, `entityId=null`); di-bind saat `archiveRepository.create`. |
| `materialType` | `Archive.materialType` + `Category(type=ARCHIVE)` | kolom traceability + kategori dibuat idempoten (label enum). |
| `date` | `Archive.date` | `YYYY-MM-DD` → `DateTime`. |
| `author` | `Archive.author` | free text (bukan `User`). |
| `organisation` | `Archive.organisation` | free text (bukan `Network`). |
| `countryId` / `stateId` | `Archive.countryId` / `Archive.stateId` | scalar, divalidasi di service. |
| `submitter.*` | `User` (author + `createdBy`) | `findOrCreatePublicUser`; **tidak** disimpan mentah. |
| — | `Archive.type` | `PUBLIC` (dipaksa server). |
| — | `Archive.status` | `REQUEST` (dipaksa server). |
| — | `Archive.source` | `PUBLIC` (dipaksa server). |
| — | `Archive.categoryIds` | dari `materialType` (bila ada); selain itu kosong. |

---

## 7. Error & Exception

Format standar: `{ statusCode, message, errors }` (RULES bab 5).

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `POST /archive-submissions` | `UnprocessableEntityException` | 422 | validasi DTO per-field; `countryId`/`submitter.countryId` tak ada; `stateId`/`submitter.stateId` bukan milik country; `attachments.N` tak ada / salah tipe / sudah ter-bind; `thumbnail` bukan milik storage EGS |
| `POST .../thumbnail` | `UnprocessableEntityException` | 422 | file hilang / MIME tak didukung / terlalu besar (dari `ImageService`) |
| `POST .../attachments` | `UnprocessableEntityException` | 422 | file hilang / bukan PDF (mime + magic-byte `%PDF-`) / terlalu besar (`DocumentUploadInterceptor` + `DocumentService`) |
| `POST /archive-submissions*` | `HttpException` (429) | 429 | rate limit terlampaui (§9) |
| semua | `BadRequestException` | 400 | payload/query tak dapat dipahami |

> Tidak ada lagi 409 (approve/reject submission) maupun 404 detail submission — endpoint tersebut dihapus. Transisi status archive yang tidak valid → **409** ditangani modul `archive` ([archive.md §5](./archive.md#5-aturan-status)).

---

## 8. Permission

**Tidak ada permission baru.** Submit publik murni `@Public()` → tidak butuh permission apa pun.

- Hapus **3** code `archive-submission:*` dari `libs/prisma/seed-data.ts` (baris 74–76): `archive-submission:read`, `archive-submission:approve`, `archive-submission:reject`.
- `admin` tetap mendapat semua code via `DEFAULT_PERMISSIONS.map`.
- Review admin memakai `archive:read` / `archive:approve` / `archive:reject` yang **sudah ada** ([archive.md §10](./archive.md#10-permission--seed)).

Update `rbac.md` §7 (angka asli saat ini **70** code → **67**): hapus baris `archive-submission:*` di tabel matriks role → permission, dan dari daftar resource di konstanta deskriptif. `member`/`author` (15 code) tidak berubah.

---

## 9. Keamanan & Anti-Spam

**Rencana.** Endpoint tulis publik tanpa auth = permukaan serangan terbuka. `ThrottlerModule` sudah global — cukup `@UseGuards(ThrottlerGuard)` + `@Throttle`.

1. **Rate limit** — `POST /archive-submissions` (~5/menit) + `.../thumbnail` (~10/menit) + `.../attachments` (~10/menit), per-IP. Wajib `app.set('trust proxy', 1)` di belakang reverse proxy.
2. **Validasi ketat** — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`; `@MaxLength`/`@ArrayMaxSize`; body JSON limit ketat (~64–100 kb). `status`/`source`/`type`/`categoryIds`/`documentIds`/`createdBy` tidak bisa disuntik dari body.
3. **Upload hardening (thumbnail)** — MIME allowlist + size cap (`UPLOAD_MAX_SIZE_MB`), magic-byte sniff, tolak SVG, re-encode via `ImageProcessor`, key UUID, `entityType` di-hardcode `'archive'`.
4. **Upload hardening (PDF publik)** — PDF-only (mime + magic-byte `%PDF-`), max 10 MB (`UPLOAD_DOCUMENT_MAX_SIZE_MB`), cap 20 attachment (`@ArrayMaxSize(20)`), throttle 10/menit, `entityType` di-hardcode `'archive'`, key S3 `documents/<uuid>.pdf`, filename tidak dipercaya.
5. **Thumbnail URL trust** — `imageService.isTrustedUnboundUrl(url, 'archive')` (prefix `S3_PUBLIC_BASE_URL` + baris `Image` `entityType='archive'`, `entityId=null`); selain → 422.
6. **CORS** — origin allowlist dari env (domain EGS), bukan `*`.
7. **Bot mitigation** — honeypot / captcha (opsional).
8. **Anti stored-XSS** — `description` teks biasa; `externalLinks` hanya URL tervalidasi.
9. **Privasi/GDPR** — submitter disimpan sebagai `User` login-less (email di-lowercase, password acak); jangan log PII; simpan `hash` IP bila perlu retensi.
10. **No info leak** — respons publik hanya `{ id, status }`; error generik tanpa stack trace.
11. **Bypass workflow dicegah** — publik hanya bisa membuat baris `REQUEST`/`PUBLIC`; tidak bisa menyetel `status`/`type`/`categoryIds`. Hanya admin (`archive:approve`/`archive:reject`) yang mengubah status.

---

## 10. Cleanup & Dampak

- **Hapus** folder `libs/src/modules/archive-submission/`.
- **Hapus registrasi**: `libs/src/libs.module.ts` (baris 29 import, 66 imports, 97 exports), `libs/src/index.ts` (baris 154–160).
- **`apps/app/src/app.module.ts`**: `ArchiveSubmissionsController` tetap terdaftar (baris 38, 83); buang `ArchiveSubmissionService` dari DI controller.
- **`upload-image.dto.ts`**: pastikan `'archive'` ada di `@IsIn`; `'archive-submission'` boleh dihapus.
- **Dampak FE**: hapus section dashboard "pending archive submissions" + `src/features/archive-submission/`; admin memakai halaman `/archives`. Rujuk `frontend/docs/module/archive-submission.md`, `frontend/docs/module/event-submission.md`, `frontend/docs/module/archive.md`.
- **`openapi.yaml`** (`backend/docs/openapi/openapi.yaml`): hapus `GET /archive-submissions`, `GET /archive-submissions/{id}`, `POST /archive-submissions/{id}/approve`, `.../reject`, schema `ArchiveSubmission*`; sesuaikan `POST /archive-submissions` (field baru, `entityType='archive'`). **Di luar scope dokumen ini** — catat sebagai TODO.

---

## 11. Catatan

### 11.1 Keputusan desain

- **Satu tabel (`archives`)** — submit publik langsung menulis baris `Archive` `status=REQUEST`, `source=PUBLIC` (mirror event/story pasca migrasi). Tidak ada tabel `archive_submissions`.
- **Bypass scope** — pemanggil publik tanpa permission; `ArchiveService.create` menolak (`scope.kind` bukan `all`/`network`/`own`). Karena itu `createPublicSubmission` membangun `CreateArchiveData` & memanggil `ArchiveRepository.create` langsung (server yang menetapkan status/source/type).
- **Submitter → `User`**, bukan JSON mentah — pola `findOrCreatePublicUser` yang sama dengan event-submission.
- **Field EGS dipetakan ke kolom `Archive`** (bukan tabel audit). `author`/`organisation`/`date`/geo disimpan apa adanya; kategori dari `materialType`.
- **PDF publik ter-bind saat submit** (bukan approve). `entityType='archive'` sejak upload.

### 11.2 Keputusan terbuka (perlu konfirmasi saat implementasi)

1. **Cara publish `Archive` hasil approve.** `ARCHIVE_TRANSITIONS.approve` existing `REQUEST → PUBLISHED` → approve langsung menayangkan. Apakah ini yang diinginkan, atau admin perlu tahap edit dulu (mis. `REQUEST → APPROVED` → edit → `publish`)?
2. **`author`/`organisation`/`date`/geo** — simpan apa adanya (kolom scalar) vs petakan ke `Network`/relasi? Desain ini memilih **apa adanya** demi kesederhanaan.
3. **Orphan document cleanup** — baris `Document` `entityId=null` (upload lalu batal/`reject`) tidak terhapus otomatis → TODO cleanup worker (`libs/src/commands/`). Lihat [archive.md §9](./archive.md#9-link-eksternal--dokumen-pdf-upload-s3).

---

## 12. Acceptance Criteria

- [ ] Submit anonim `POST /archive-submissions` payload lengkap → `201 { data: { id, status: "REQUEST" } }`; baris `archives` ber-`source=PUBLIC`, `status=REQUEST`, `type=PUBLIC`.
- [ ] `attachments` → baris `Document` (`entityType='archive'`, `entityId=<archive.id>`).
- [ ] `materialType` → `Category(type=ARCHIVE)` idempoten + ter-link ke `archive_categories`.
- [ ] `submitter` → `User` login-less (find-or-create) sebagai `createdBy` + author.
- [ ] `GET /archives?filter[status]=REQUEST` (admin) menampilkan usulan.
- [ ] `POST /archives/:id/approve` / `reject` mengubah status sesuai `ARCHIVE_TRANSITIONS`.
- [ ] Field asing dalam body → `422`; rate limit → `429`.
- [ ] Tidak ada lagi tabel/servis/endpoint `archive-submission` (kecuali controller publik 3 endpoint).
- [ ] `pnpm tsc --noEmit`, `pnpm lint` lulus.

---

## 13. Verifikasi

```bash
# submit payload lengkap (publik)
curl -X POST "$API_BASE_URL/archive-submissions" \
  -H "Content-Type: application/json" \
  -d '{"name":"Gamelan 1970s Recordings","description":"Field recordings archive.","materialType":"DOCUMENTARIES","date":"1974-05-01","author":"J. Doe","organisation":"EGS","countryId":1,"externalLinks":["https://example.org/recordings"],"submitter":{"fullName":"J. Doe","email":"jane@example.com","countryId":1}}'

# upload PDF attachment (publik, field file tunggal)
curl -X POST "$API_BASE_URL/archive-submissions/attachments" -F "file=@program.pdf"

# review admin (list usulan)
curl "$API_BASE_URL/archives?filter[status]=REQUEST" -H "Authorization: Bearer $TOKEN"
```

```bash
pnpm prisma migrate dev --name drop_archive_submissions_add_archive_public_source
pnpm prisma:generate
pnpm prisma:seed
pnpm tsc --noEmit
pnpm lint
```
