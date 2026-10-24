# Module: Archive

Menu: [rbac.md](./rbac.md) (master) · [story.md](./story.md) (pola acuan) · [event.md](./event.md) · sibling FE: `frontend/docs/module/archive.md`

> **STATUS: IMPLEMENTED (termasuk workflow submit/approve/reject/publish/unpublish).** Model `Archive`, modul, controller, migration, dan seed sudah ada. Archive memakai `ArchiveStatus` (`DRAFT | REQUEST | APPROVED | PUBLISHED`) + row-level scoping via `AccessScopeService` (`resource = 'archive'`). Lihat [§5](#5-aturan-status), [§6](#6-scoping-baca--tulis), [§10](#10-permission--seed), [§13](#13-status--catatan).

---

## 1. Deskripsi & Lokasi

Modul **`archive`** mengelola `Archive` (label menu frontend: **Archives** / "arsip seni & penelitian"). Nama resource backend: **`archive`**. Archive **bukan** `Post` — model Prisma terpisah.

Archive dimiliki oleh max satu creator (`Archive.createdBy → User.id`, nullable) dan berisi banyak kategori (`Category`) melalui join **`ArchiveCategory`** (N : M). Berbeda dari story:

- `description` = **teks biasa** (textarea), **bukan** rich HTML. Story yang memiliki konten rich.
- **Tidak ada `slug`** — archive memakai `id` di URL ([§13](#13-status--catatan) catatan simplifikasi).
- **Workflow approval bertingkat** (mirror event): status `DRAFT | REQUEST | APPROVED | PUBLISHED` dengan endpoint `submit/approve/reject/publish/unpublish` ([§5](#5-aturan-status)).
- Punya daftar **link eksternal** (`externalLinks string[]`) dan **dokumen PDF** yang diupload lewat **endpoint terpisah** `POST /documents` (modul + tabel `Document` baru), direferensikan sebagai scalar `documentIds string[]` (berurut) menunjuk baris `Document`.
- `thumbnail` = **URL absolut S3** (`String?`) saja; diupload lewat `POST /images` yang **sudah ada tanpa perubahan** ([§9](#9-link-eksternal--dokumen-pdf-upload-s3)).
- `type` (`MEMBER`/`PUBLIC`): `PUBLIC` = metadata publik; `MEMBER` = **member-only** → bila pemanggil tanpa akses member (`canViewPrivate === false` **dan** `isMember === false`), `externalLinks` (list & detail) dan `documents` (detail) di-null-kan. `PUBLIC` maupun pemanggil berhak (`canViewPrivate || isMember`) tidak terpengaruh. Scoping baris tetap lewat `AccessScopeService` ([§6](#6-scoping-baca--tulis)).
- Kategori memakai tabel `Category` **shared** dengan story lewat diskriminator `Category.type = 'ARCHIVE'`.

```
libs/src/modules/archive/
├── archive.repository.ts
├── archive.service.ts
├── archive.module.ts
├── dto/
│   ├── create-archive.dto.ts
│   ├── update-archive.dto.ts
│   └── list-archives-query.dto.ts
└── entities/
    └── archive.entity.ts

libs/src/modules/document/           ← BARU (PDF, tabel `documents`)
├── document.repository.ts
├── document.service.ts
├── document.module.ts
├── dto/
│   └── upload-document.dto.ts
└── entities/
    └── document.entity.ts

libs/src/modules/image/              ← TIDAK BERUBAH (mime png/jpeg/webp saja)
libs/src/modules/category/            ← dipakai ulang (type=ARCHIVE), tanpa perubahan struktur
libs/src/integrations/storage/
└── storage.service.ts                ← klien S3 (dipakai ulang oleh dokumen, tanpa sharp)

apps/app/src/controllers/
├── archives.controller.ts
└── documents.controller.ts           ← BARU
```

- Modul bisnis & service di `libs/src/modules/` (RULES bab 3).
- Controller di `apps/app/src/controllers/` — controller tipis, delegasi ke service.
- Alur baku: `Controller → Service → Repository → Prisma`. Repository satu-satunya tempat query Prisma.
- `services/`? **Tidak**. `archive.service.ts` sebagai file tunggal di root folder modul — konsisten dengan `post`/`event`.

### Keputusan desain

| Skenario | Jalur | Akses |
| --- | --- | --- |
| CRUD archive admin | `/api/v1/archives*` | PERMISSION `archive:*` |
| Upload dokumen PDF | `POST /api/v1/documents` (mime `application/pdf` saja) | PERMISSION ANY-of (`archive:create` / `archive:update`) |
| CRUD kategori archive | `/api/v1/categories*` | PERMISSION `category:*` (shared, tak berubah) |
| Upload thumbnail archive | `POST /api/v1/images` (**TAK BERUBAH**) | PERMISSION ANY-of (`story:create` / `story:update` / `event:create` / `event:update`) — lihat caveat [§9](#9-link-eksternal--dokumen-pdf-upload-s3) |
| Tampilkan dokumen/gambar | URL S3/CDN (bucket public-read) | **PUBLIC** (dilayani S3/CDN, bukan API) |

---

## 2. Model Prisma

Model (ada di `libs/prisma/schema.prisma`):

```prisma
enum ArchiveType {
  MEMBER
  PUBLIC
}

enum ArchiveStatus {
  DRAFT
  REQUEST
  APPROVED
  PUBLISHED
}

model Archive {
  id            String        @id @default(uuid())
  name          String        // judul
  description   String?       // deskripsi, teks biasa (bukan rich HTML)
  thumbnail     String?       // URL absolut S3
  type          ArchiveType   @default(PUBLIC)
  status        ArchiveStatus @default(DRAFT)
  publishedAt   DateTime?     @map("published_at")
  approvedAt    DateTime?     @map("approved_at")  // audit marker "pertama kali terbit" (server-managed)
  externalLinks String[]      @default([]) @map("external_links")  // daftar URL, berurut
  documentIds   String[]      @default([]) @map("document_ids")    // id Document, berurut
  createdBy     String?       @map("created_by")
  creator       User?         @relation("ArchiveCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  categories    ArchiveCategory[]
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  @@index([createdBy])
  @@map("archives")
}

model ArchiveCategory {
  id         String   @id @default(uuid())
  archiveId  String   @map("archive_id")
  archive    Archive  @relation(fields: [archiveId], references: [id], onDelete: Cascade)
  categoryId String   @map("category_id")
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@unique([archiveId, categoryId])
  @@index([archiveId])
  @@index([categoryId])
  @@map("archive_categories")
}

// BARU: tabel dokumen terpisah (mirror `images` minus kolom image-specific).
model Document {
  id         String   @id @default(uuid())
  entityType String   @map("entity_type")
  entityId   String?  @map("entity_id")
  key        String   @unique
  filename   String
  mimeType   String?  @map("mime_type")
  size       Int?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@index([entityType, entityId])
  @@map("documents")
}
```

> **`Document` = tabel baru, terpisah dari `Image`.** Struktur mirror `Image` **minus** kolom image-specific (`width`, `height`, `variants`). PDF **tidak** memakai `Image`, **tidak** memakai `sharp`, **tidak** punya varian. `Document.entityId = archive.id`, `Document.entityType = 'archive'` mengikat dokumen ke archive (pola sama galeri story). Urutan & keanggotaan archive disimpan di scalar `Archive.documentIds`.

### Penyesuaian schema yang diperlukan

- `Category` (sudah ada) → tambah back-relation **`archives ArchiveCategory[]`**. Tidak ada perubahan kolom; `Category.type` (`CategoryType` `STORY | ARCHIVE`, sudah ada) menjadi diskriminator. Archive selalu memfilter `type = 'ARCHIVE'`.
- `User` (sudah ada) → tambah back-relation **`archives Archive[] @relation("ArchiveCreator")`**.
- `Image` (sudah ada) → **tidak berubah**. Thumbnail archive hanyalah URL string; tidak ada baris `Image` yang di-bind ke archive ([§9](#9-link-eksternal--dokumen-pdf-upload-s3)).

### Catatan model

- **`ArchiveCategory` tabel join baru.** Tidak bisa memakai ulang `PostCategory` (FK-nya menunjuk `Post`). `@@unique([archiveId, categoryId])` mencegah link duplikat; `onDelete: Cascade` di kedua sisi.
- **Tidak ada `slug`.** Archive memakai `id` (UUID) di URL. **Simplifikasi sadar** — menghindari kolom unik + generator slug + collision handling (lihat [story.md §5](./story.md#5-aturan-slug)). Upgrade path: tambah `slug String? @unique` + util `slugify` bila SEO/url manusiawi dibutuhkan.
- **`description` teks biasa** (`String?`), **bukan** HTML. Story memiliki rich content; archive cukup deskripsi singkat. FE memakai `<textarea>`/plain text, bukan WYSIWYG. **Simplifikasi sadar** (tidak ada sanitasi HTML, tidak ada risiko XSS dari archive).
- **`externalLinks`** = `String[]` (Postgres `TEXT[]`, default `[]`). Urutan array = urutan tampil. Diganti **seluruhnya** bila field dikirim saat update.
- **`documentIds` (scalar `String[]`, bukan relasi).** Menyimpan id baris `Document` secara **berurut**; keanggotaan archive = binding `Document.entityId/entityType` (pola galeri story, tapi tabel sendiri). Request tetap memakai `documentIds: string[]` (berurut) — service memvalidasi & mem-bind baris `Document`. Detail di-resolve jadi `documents: DocumentResponse[]` berurut; list **tidak** menyertakan `documents`. `documentIds` mentah **tidak** dikembalikan ke FE ([§3](#3-entity-payload-type), [§9](#9-link-eksternal--dokumen-pdf-upload-s3)).
- **`thumbnail`** = URL absolut S3 (`String?`), pola sama dengan `Post.thumbnail`. **Tidak ada `imageIds`**: baris `Image` tidak di-bind ke archive (konsekuensi orphan — [§9](#9-link-eksternal--dokumen-pdf-upload-s3)).
- **`type`** default `PUBLIC`; **`status`** default `DRAFT`.
- **`approvedAt`** = marker audit "pertama kali terbit" (server-managed), **bukan** status `APPROVED`; diisi saat `approve`/`publish`/create-langsung-PUBLISHED bila belum ada.
- `createdBy` nullable + `onDelete: SetNull`; user dihapus → archive tetap ada, `creator` null.
- **`Document` tanpa `width`/`height`/`variants`** — PDF only, tanpa pemrosesan gambar.

### Kebutuhan migration

Migration (ada di `libs/prisma/migrations/`):

```bash
# libs/prisma/migrations/<timestamp>_add_archives/migration.sql
#   CREATE TYPE "ArchiveType" AS ENUM ('MEMBER', 'PUBLIC');
#   CREATE TYPE "ArchiveStatus" AS ENUM ('DRAFT', 'PUBLISHED');
#   CREATE TABLE "archives" (...);   -- termasuk "document_ids" TEXT[] NOT NULL DEFAULT '{}'
#   CREATE TABLE "archive_categories" (...);
#   ALTER TABLE "users" (tidak berubah kolom; hanya relasi Prisma)
#   Category: tidak berubah kolom (relasi Prisma)

# libs/prisma/migrations/<timestamp>_add_documents/migration.sql
#   CREATE TABLE "documents" (...);  -- tabel baru, tanpa width/height/variants
#   CREATE UNIQUE INDEX "documents_key_key" ON "documents"("key");
#   CREATE INDEX "documents_entity_type_entity_id_idx" ON "documents"("entity_type", "entity_id");

# libs/prisma/migrations/20260924130000_add_archive_workflow/migration.sql   -- SUDAH DIBUAT
#   ALTER TYPE "ArchiveStatus" ADD VALUE 'REQUEST' BEFORE 'PUBLISHED';
#   ALTER TYPE "ArchiveStatus" ADD VALUE 'APPROVED' BEFORE 'PUBLISHED';
#   ALTER TABLE "archives" ADD COLUMN "approved_at" TIMESTAMP(3);

pnpm prisma:generate
# lalu bila seed permission ditambah:
pnpm prisma:seed
```

> **Dua migration**: `add_archives` (archive + join) dan `add_documents` (**tabel baru** `documents`). `Image` **tidak** ikut migration (tidak disentuh). Penyesuaian back-relation `Category`/`User` tidak menambah kolom (hanya metadata Prisma), tetapi tetap ikut migration agar skema DB sinkron.

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4). Satu payload type per model, definisi di `entities/`.

```typescript
// libs/src/modules/archive/entities/archive.entity.ts
import { CategoryType, Prisma } from '@prisma/client';
import type { DocumentResponse } from '@app/libs/modules/document/document.service';

// `archiveSelect` query raw (join shape). JANGAN dikembalikan langsung ke API.
export const archiveSelect = {
  id: true,
  name: true,
  description: true,
  thumbnail: true,
  type: true,
  status: true,
  publishedAt: true,
  approvedAt: true,
  externalLinks: true,
  documentIds: true,
  creator: { select: { id: true, fullName: true, networkId: true } },
  categories: {
    select: {
      category: { select: { id: true, name: true, type: true } },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArchiveSelect;

export type ArchiveRow = Prisma.ArchiveGetPayload<{ select: typeof archiveSelect }>;

export type ArchiveCategoryEntity = { id: string; name: string; type: CategoryType };

// Kontrak response API: `categories` flat (bukan `[{ category }]`).
// Mirror `PostEntity`: `documentIds` mentah tetap ada di entity internal (dipakai hydrate).
// `creator.networkId` HANYA internal (row-level scoping); dibuang di response.
export type ArchiveEntity = Omit<ArchiveRow, 'categories'> & { categories: ArchiveCategoryEntity[] };

export type ArchiveCreatorRef = { id: string; fullName: string };

// Item LIST = `ArchiveEntity` TANPA `documentIds` dan tanpa `creator.networkId`.
export type ArchiveListItem = Omit<ArchiveEntity, 'documentIds' | 'creator'> & {
  creator: ArchiveCreatorRef | null;
};

// Kontrak DETAIL (`GET /archives/:id`): `documentIds` mentah diganti `documents` hasil resolusi berurut.
export type ArchiveResponse = ArchiveListItem & {
  documents: DocumentResponse[];
};

export function mapArchive(row: ArchiveRow): ArchiveEntity {
  return { ...row, categories: row.categories.map((link) => link.category) };
}
```

> **Flatten `categories`.** Repository selalu mengembalikan `ArchiveEntity` (flat): `row.categories.map(c => c.category)` via `mapArchive()`. Join shape `[{ category }]` tidak boleh bocor ke service/controller. Diterapkan konsisten di `findAll`, `findById`, `create`, `update`, `delete`.

> **Resolve `documents` — HANYA detail.** `documentIds` ada di `archiveSelect` (scalar). `ArchiveService.hydrate()` mengubah `ArchiveEntity.documentIds` → `ArchiveResponse.documents: DocumentResponse[]` lewat `DocumentRepository.findByIds` + `DocumentService.toDocumentResponse` (jangan duplikasi logika URL), **pola identik story `gallery`**. Urutan `documents` = urutan `documentIds`; id yang tidak ditemukan di-**skip**. `documentIds` mentah **tidak** dikembalikan ke FE. **Item list = `ArchiveListItem` (tanpa `documentIds`/`documents`)** — hanya detail `GET /archives/:id` yang hydrate; list tidak melakukan lookup tambahan (hindari N+1).

> **`externalLinks` dikembalikan apa adanya** (`string[]`, urut) — tidak ada resolusi. Pengecualian: `type=MEMBER` + `canViewPrivate=false` → `externalLinks` (list & detail) dan `documents` (detail) di-null-kan; `PUBLIC`/pemanggil berhak tidak berubah ([§1](#1-deskripsi--lokasi)).

- `creator` sengaja minimal di response (`id`, `fullName`); `networkId` dipilih untuk scoping lalu **dibuang** ([§3](#3-entity-payload-type)).
- **`url` dokumen TIDAK disimpan di DB**; dihitung `DocumentService.toDocumentResponse` dari `key` + `S3_PUBLIC_BASE_URL`.
- **Tidak ada** select yang menyertakan kolom sensitif.

---

## 4. DTO

Status validasi gagal = **422** (RULES bab 7). Kontrak 422: `{ statusCode: 422, message: 'Validation failed', errors: [{ field, message }] }`. Semua `@Param('id')` pakai `ParseUUIDPipe`.

```typescript
// libs/src/modules/archive/dto/create-archive.dto.ts
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { ArchiveStatus, ArchiveType } from '@prisma/client';

export class CreateArchiveDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  // Teks biasa, bukan rich HTML.
  @IsOptional()
  @IsString()
  description?: string;

  // URL absolut hasil `POST /images` (endpoint image TIDAK berubah). Tidak ada `imageIds`.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string;

  @IsOptional()
  @IsEnum(ArchiveType)
  type?: ArchiveType; // default PUBLIC

  @IsOptional()
  @IsEnum(ArchiveStatus)
  status?: ArchiveStatus; // default DRAFT; scope non-`all` dipaksa DRAFT (lihat §6)

  // Bila dikirim → paksa status = PUBLISHED ([§5](#5-aturan-status)).
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  // Urutan link = urutan array. Diganti seluruhnya bila dikirim saat update.
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(50)
  externalLinks?: string[];

  // Urutan dokumen = urutan array (id baris `Document` hasil `POST /documents`).
  // Bind/unbind baris `Document` (entityId/entityType='archive') saat create/update.
  // Update = replace seluruh array.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  documentIds?: string[];
}
```

```typescript
// libs/src/modules/archive/dto/update-archive.dto.ts
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateArchiveDto } from './create-archive.dto';

export class UpdateArchiveDto extends PartialType(OmitType(CreateArchiveDto, ['thumbnail'] as const)) {
  // `undefined` = jangan sentuh; `null` = hapus thumbnail.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string | null;
}
```

> `CreateArchiveDto.thumbnail` tetap `string` opsional. Hanya `UpdateArchiveDto` menerima `string | null`; service/repository membedakan `undefined` (jangan sentuh) vs `null` (set NULL).
>
> `categoryIds` / `externalLinks` / `documentIds` saat update = **replace seluruh array** bila dikirim; `undefined` = jangan sentuh. `documentIds` = binding/urutan baris `Document` (scalar `Archive.documentIds`), id yang dilepas di-unbind (`entityId = null`), bukan disimpan mentah ke API. **`CreateArchiveDto` TIDAK punya `imageIds`** — thumbnail cukup URL string.

```typescript
// libs/src/modules/archive/dto/list-archives-query.dto.ts
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListArchivesQueryDto extends ListQueryDto {}
```

> Catatan: `filter` generik tetap `Record<string, unknown>` dari `ListQueryDto`; whitelist di-enforce di service/repository via konstanta (`ARCHIVE_FILTER_FIELDS` dll — [§8](#8-kontrak-list-rules-bab-1919a19b)), bukan lewat dekorator DTO.

```typescript
// libs/src/modules/document/dto/upload-document.dto.ts
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  // Diisi FE; default 'archive' bila tidak dikirim (permukaan upload dokumen saat ini khusus archive).
  @IsOptional()
  @IsString()
  @IsIn(['archive'])
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  entityType?: string;
}
```

> **`POST /documents` memakai `UploadDocumentDto` terpisah** (bukan `UploadImageDto`). Field file wajib `multipart/form-data` + `file`; validasi mime/size di `DocumentUploadInterceptor` → 422 ([§9](#9-link-eksternal--dokumen-pdf-upload-s3)).

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `name` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` | 422 `{ field: 'name', message }` |
| `description` | opsional, `@IsString()` (teks biasa) | 422 `{ field: 'description', message }` |
| `thumbnail` | opsional, `@IsString()`, `@MaxLength(2048)`; pada `UpdateArchiveDto` boleh `null` (hapus) | 422 `{ field: 'thumbnail', message }` |
| `type` | opsional, `@IsEnum(ArchiveType)`; default `PUBLIC` | 422 `{ field: 'type', message }` |
| `status` | opsional, `@IsEnum(ArchiveStatus)`; default `DRAFT` | 422 `{ field: 'status', message }` |
| `publishedAt` | opsional, `@IsISO8601()`; bila ada → paksa `status=PUBLISHED` ([§5](#5-aturan-status)) | 422 `{ field: 'publishedAt', message }` |
| `notify` | opsional, `@IsBoolean()`; default `true`. `false` → tidak enqueue notifikasi saat auto-publish (`create`/`update`) atau `approve`/`publish`; tidak disimpan | 422 `{ field: 'notify', message }` |
| `categoryIds` | opsional, `@IsArray()`, `@IsUUID('4', { each: true })`; service wajibkan semua `Category.type = 'ARCHIVE'` ([§7](#7-repository--service)) | 422 `{ field: 'categoryIds.0', message }` |
| `externalLinks` | opsional, `@IsArray()`, `@IsUrl({}, { each: true })`, `@ArrayMaxSize(50)` | 422 `{ field: 'externalLinks.0', message }` |
| `documentIds` | opsional, `@IsArray()`, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(50)`; urutan = urutan dokumen; service wajibkan id ada & belum ter-bind archive lain ([§7](#7-repository--service)) | 422 `{ field: 'documentIds.0', message }` |
| `:id` path | `ParseUUIDPipe` | 422/400 UUID invalid |

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "name", "message": "name should not be empty" }]
}
```

> **Batasan ukuran `file` (multipart)** ditegakkan di `POST /documents` untuk PDF — lihat [§9](#9-link-eksternal--dokumen-pdf-upload-s3).

---

## 5. Aturan Status

- Default `status` = `DRAFT` (schema `@default(DRAFT)`).
- **Workflow approval** (mirror event): `DRAFT → REQUEST → {PUBLISHED | DRAFT}`, `DRAFT → PUBLISHED` (approve/publish langsung oleh approver), dan `APPROVED → PUBLISHED` (legacy), `PUBLISHED → DRAFT`. Aturan tunggal ada di `ARCHIVE_TRANSITIONS` (`libs/src/modules/archive/archive.service.ts`).
- **Tidak ada penjadwalan otomatis.** Tidak ada worker/cron. Bila `publishedAt` masa depan dikirim, backend hanya menyimpannya; predikat publik (`isPublished`) mensyaratkan `status = PUBLISHED` **dan** `publishedAt <= now`, jadi konten terjadwal belum terlihat publik sampai waktunya.

### `ARCHIVE_TRANSITIONS` (identik dengan `EVENT_TRANSITIONS`)

| Action | Endpoint | From → To | Permission |
| --- | --- | --- | --- |
| `submit` | `POST /archives/:id/submit` | `DRAFT → REQUEST` | `archive:submit` |
| `approve` | `POST /archives/:id/approve` | `DRAFT\|REQUEST → PUBLISHED` | `archive:approve` |
| `reject` | `POST /archives/:id/reject` | `REQUEST → DRAFT` | `archive:reject` |
| `publish` | `POST /archives/:id/publish` | `DRAFT\|APPROVED → PUBLISHED` | `archive:publish` |
| `unpublish` | `POST /archives/:id/unpublish` | `PUBLISHED → DRAFT` | `archive:unpublish` |

- Status saat ini tidak cocok dengan `from` → **409** `Cannot <action> archive in status <STATUS>`.
- Update atomik via `archiveRepository.updateStatusIf(id, from, to, extra)` (`updateMany` conditional); `from` = status aktual hasil baca (bukan array) sehingga kalah balapan → 409 (status di-fetch ulang).
- **Siapa yang boleh publish.** `archive:approve` dan `archive:publish` sama-sama gate publish: approver boleh menerbitkan langsung dari `DRAFT` (tanpa `submit`), atau dari `REQUEST` (jalur usulan/review). `submit` (`archive:submit`) tetap jalur minta-review; `archive:update` **tidak** bisa publish.
- `approve`/`publish` menerima **body opsional** `PublishContentDto` `{ publishedAt?: string, notify?: boolean }`: `publishedAt = body ? new Date(body) : (existing ?? now)`; `approvedAt` diisi `existing ?? now` (server-managed). `notify` default `true`; `false` → tidak enqueue notifikasi (juga berlaku di `create`/`update` auto-publish).
- `submit`/`reject`/`unpublish` tidak menerima body.

### Create

- `publishedAt` dikirim → `publishedAt = new Date(dto.publishedAt)` **dan** paksa `status = PUBLISHED`; `approvedAt = now` (tanggal publish menyiratkan terbit).
- `publishedAt` tidak dikirim → `publishedAt = now` + `approvedAt = now` hanya bila `status = PUBLISHED`; `null` bila tidak (default `DRAFT`).
- Scope non-`all` **memaksa** `status = DRAFT` + membuang `publishedAt` (tutup bypass workflow) — [§6](#6-scoping-baca--tulis).

### Update (`PATCH /archives/:id`)

- Scope `all`: `publishedAt` string → timpa + paksa `PUBLISHED` (+`approvedAt` bila masih null); `publishedAt: null` → kosongkan tanggal (status dibiarkan); else `status` PUBLISHED mengisi `publishedAt`/`approvedAt` bila masih null.
- Scope non-`all`: `status`/`publishedAt` dari body **diabaikan**, KECUALI pemilik/organisasi boleh menurunkan `PUBLISHED → DRAFT` (retract). Transisi lain wajib lewat endpoint action.

```typescript
// libs/src/modules/archive/archive.service.ts
export const ARCHIVE_TRANSITIONS: Record<ArchiveAction, { from: ArchiveStatus[]; to: ArchiveStatus }> = {
  submit: { from: [ArchiveStatus.DRAFT], to: ArchiveStatus.REQUEST },
  approve: { from: [ArchiveStatus.DRAFT, ArchiveStatus.REQUEST], to: ArchiveStatus.PUBLISHED },
  reject: { from: [ArchiveStatus.REQUEST], to: ArchiveStatus.DRAFT },
  publish: { from: [ArchiveStatus.DRAFT, ArchiveStatus.APPROVED], to: ArchiveStatus.PUBLISHED },
  unpublish: { from: [ArchiveStatus.PUBLISHED], to: ArchiveStatus.DRAFT },
};
```

> `approvedAt` = audit marker "pertama kali terbit" (server-managed), **bukan** status `APPROVED`; selalu ada di `archiveSelect`.

---

## 6. Scoping Baca & Tulis

Resource `archive` **sudah** ditambahkan ke `AccessScopeService` (`ContentResource = 'story' | 'event' | 'archive'`; `CONTENT_RESOURCES`). `resolve(userId, 'archive')` mengembalikan `AccessScope` berbasis permission per-resource (bukan nama role):

| Kondisi permission | Scope `.kind` |
| --- | --- |
| punya salah satu `archive:approve`/`publish`/`reject`/`unpublish` | `all` |
| punya salah satu `archive:create`/`update`/`submit` **dan** `networkId` | `network` |
| punya salah satu `archive:create`/`update`/`submit` tanpa `networkId` | `own` |
| selain itu | `published` |
| (list early-return bila tidak ada baris) | `none` |

**Archive TIDAK punya kolom `visibility`.** Predikat "terbit publik" archive = `{ status: PUBLISHED, publishedAt: { not: null, lte: now } }` (dipakai sama untuk scope `own`, `published`, dan `scopeWhere`). Tidak ada referensi `visibility` di service archive.

**Redaksi member-only.** Akses member = `canViewPrivate || isMember` (membership billing aktif: `Billing.status=PAID` **dan** `expiryDate>now`, via `BillingService.hasActiveMembership`). Nilai itu di-thread ke `hydrate`/`toListItem`. Bila `type=MEMBER` **dan** `canViewPrivate=false` **dan** `isMember=false`, `externalLinks` (list & detail) dan `documents` (detail) di-set `null` lewat helper `redactMemberOnly` (pure, diekspor dari `archive.entity.ts`). `PUBLIC` dan pemanggil berhak (`canViewPrivate || isMember`) tidak berubah; `description` tetap terlihat. Bukan access-control loosening — scope baris tetap.

`canViewPrivate` pada `AccessScope` dihitung **GLOBAL** lintas seluruh content resource (`story`/`event`/`archive`): punya permission tulis/moderator apa pun pada salah satu resource — termasuk `archive:*` — membuat user dapat membaca konten `story`/`event` yang `PRIVATE`; ini **intentional** dan **bukan** per-resource (lihat [rbac.md §10](./rbac.md#10-row-level-scoping), [story.md H1](./story.md)). `isMember` (membership aktif) juga memberi akses baca `MEMBER`/`PRIVATE` meski tanpa permission tulis konten apa pun — lihat [rbac.md §10](./rbac.md#10-row-level-scoping).

`scopeWhere(scope)` di `ArchiveService`:

- `all` → `undefined` (tanpa filter).
- `network` → `{ creator: { networkId } }`.
- `own` → `{ OR: [{ createdBy: userId }, { status: PUBLISHED, publishedAt: { not: null, lte: now } }] }`.
- `published` → `{ status: PUBLISHED, publishedAt: { not: null, lte: now } }`.
- `none` → `{ id: { in: [] } }` (list early-return `{ items: [], total: 0 }`).

Otorisasi baris (mirror event, tanpa `visibility`):

- **Baca** (`list`/`findOne`): scope diterapkan; `assertReadable` → `404` (not found) atau `403` bila di luar scope. Pemilik bebas; non-pemilik pada `own` hanya boleh membaca baris terbit (`isPublished`).
- **Tulis** (`update`/`transition`/`remove`): `assertWritable` → `all` bebas; `network` hanya baris `creator.networkId`-nya; `own` hanya `creator.id === userId`; `published`/`none` → `403` (defensif; guard permission memblok lebih dulu). **Pengecualian:** `ArchiveService.remove(id, userId, { skipScopeCheck: true })` — dipakai purge cascade hapus user (`DELETE /users/:id?cascadeContent=true`; sudah otorisasi `user:delete` + `admin:access`) — melewati `assertWritable` **hanya** agar purge tidak berhenti separuh jalan (hydrate/cleanup S3 tetap jalan). Tanpa opsi, perilaku `remove` identik seperti di atas.
- `creator.networkId` dipilih internal untuk scoping, lalu **dibuang** dari response ([§3](#3-entity-payload-type)).

---

## 7. Repository & Service

### Archive

| Method | Fungsi |
| --- | --- |
| `findAll(query, where)` | List paginated (`skip/take`, `count`), `select: archiveSelect`, sertakan `categories` + `creator`. |
| `findById(id)` | Detail; `select: archiveSelect`; tidak ada → `NotFoundException`. |
| `create(data)` | Insert + link `categoryIds` via nested `categories: { create: [...] }`; `externalLinks` disimpan apa adanya; simpan `documentIds` scalar. |
| `update(id, data)` | Update; replace link kategori (`deleteMany` + `createMany` dalam `$transaction`); `externalLinks` replace seluruh array bila dikirim; replace `documentIds` scalar bila dikirim. |
| `updateStatusIf(id, from, to, extra)` | Update status **atomik** (`updateMany` conditional `where { id, status: from }`, `extra: { publishedAt?, approvedAt? }`); return `ArchiveEntity` bila tepat 1 baris berubah, else `null` (guard anti-TOCTOU). |
| `delete(id)` | Hapus; `archive_categories` cascade otomatis (FK `onDelete: Cascade`). Baris `Document` **tidak** cascade (FK polymorphic `entityId`, tanpa relasi) → dibersihkan service ([§9](#9-link-eksternal--dokumen-pdf-upload-s3)). |

`ArchiveService` menambahkan `transition(id, action, userId, { publishedAt }?)` yang memvalidasi transisi via `ARCHIVE_TRANSITIONS` + memanggil `updateStatusIf` ([§5](#5-aturan-status)). Method `list(query, userId)`, `findOne(id, userId)`, `update(id, dto, userId)`, `remove(id, userId, { skipScopeCheck }?)` menerapkan scoping ([§6](#6-scoping-baca--tulis)). `skipScopeCheck` hanya untuk purge cascade hapus user (lihat §6).

`categoryIds` saat update = **replace set** (bukan append): hapus semua `ArchiveCategory` milik archive lalu buat ulang dari daftar baru, di dalam `$transaction`.

**Validasi tipe kategori (create & update).** Service memverifikasi **setiap** `categoryIds` milik `Category.type === 'ARCHIVE'` (ambil via `categoryRepository.findByIds`, cek `type`). Ada id milik `Category.type === 'STORY'` atau id tidak ditemukan → **422** `Validation failed` (`{ field: 'categoryIds.N', message }`). Mencegah kategori story dipakai di archive.

```typescript
// libs/src/modules/archive/archive.repository.ts
async findAll(query: ListQueryDto, where: Prisma.ArchiveWhereInput) {
  const page = query.page ?? 1;
  const take = Math.min(query.limit ?? 20, 100);
  const skip = (page - 1) * take;

  const [items, total] = await this.prisma.$transaction([
    this.prisma.archive.findMany({ where, orderBy, skip, take, select: archiveSelect }),
    this.prisma.archive.count({ where }),
  ]);

  return { items, total };
}
```

### Dokumen = modul `Document` (tabel sendiri)

Repository/service baru, **bukan** `Image`:

| Method `DocumentRepository` | Fungsi untuk archive |
| --- | --- |
| `create(data)` | Insert baris `Document` (key, filename, mimeType, size, entityType, entityId). |
| `findByIds(ids)` | Ambil baris untuk **validasi binding** (`entityId == null` atau sama) + hydrate detail (`toDocumentResponse`). |
| `findByEntity(type, id)` | Semua baris milik entity — untuk kumpulkan `key[]` sebelum delete. |
| `deleteByEntity(type, id)` | Hapus baris milik entity (setelah `key[]` dikumpulkan). |

`DocumentService` menyediakan:

| Method | Fungsi |
| --- | --- |
| `upload(file, entityType)` | Validasi mime PDF (diinterceptor) + put S3 (`documents/<uuid>.pdf`) + `repository.create` → `DocumentResponse`. |
| `toDocumentResponse(row)` | Bentuk response publik `{ id, url, key, filename, mimeType, size }`; `url = S3_PUBLIC_BASE_URL + '/' + key`. |
| `bind(ids, entityType, entityId)` **helper** | Set `entityId`/`entityType` pada row `Document` yang `entityId=null` atau sudah milik archive ini; guard mencegah rebutan lintas-entity. |
| `unbind(ids)` **helper** | Set `entityId = null` untuk id yang dilepas saat replace. |

> **`bind`/`unbind` hidup di `DocumentService`/`DocumentRepository`** (modul document). Archive memanggilnya; **jangan** menyentuh `ImageRepository`.

`ArchiveService` menerima `documentIds: string[]` (urutan = urutan dokumen):

1. `documentRepository.findByIds(dto.documentIds)` → verifikasi **setiap** id ada dan (`entityId == null` **atau** `entityId === archive.id`); melanggar → **422** (`Validation failed`).
2. `documentService.bind(documentIds, 'archive', archive.id)` — hanya menyentuh row `entityId=null` atau milik archive ini (tanpa shared-row data-loss).
3. **Replace** (`PATCH`): id lama yang dilepas (`removed = existing.documentIds − dto.documentIds`) di-`unbind` (`entityId = null`) dalam transaksi yang sama.
4. **Create**: archive dibuat dulu (mendapat `id`) lalu bind dalam `$transaction`.
5. `Archive.documentIds` scalar disimpan = urutan array. Detail di-hydrate lewat `findByIds` + `toDocumentResponse` ([§3](#3-entity-payload-type), [§9](#9-link-eksternal--dokumen-pdf-upload-s3)).

---

## 8. Kontrak List (RULES bab 19/19a/19b)

Semua list paginated via `ListQueryDto` shared (`page, limit, sortBy, sortOrder, search, filter`). `limit` clamp 100; response `{ data, meta: { page, limit, total }, message }`.

### `GET /api/v1/archives`

| Item | Nilai |
| --- | --- |
| `ARCHIVE_SEARCHABLE_FIELDS` | `['name', 'description']` |
| `ARCHIVE_SORT_FIELDS` | `['name', 'type', 'status', 'publishedAt', 'createdAt', 'updatedAt']` |
| `ARCHIVE_FILTER_FIELDS` | `['type', 'status', 'publishedAt', 'createdAt', 'updatedAt']` |
| `status` enum (filter) | `['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED']` ([§5](#5-aturan-status)) |
| `type` enum (filter) | `['MEMBER', 'PUBLIC']` |
| `ARCHIVE_DATE_FIELDS` | `['publishedAt', 'createdAt', 'updatedAt']` (ISO 8601; invalid → 422; `like` ditolak) |
| `mine` param | `'true' \| 'false'` opsional; `'true'` → AND `{ createdBy: userId }` (organisasi: `{ creator: { networkId } }`) **di-AND** dengan scope, bukan mengganti. Nilai lain → 422 |
| `sortOrder` default | `desc` (`sortBy` default `createdAt`) |
| Item select | `archiveSelect` → termasuk `categories` + `creator`; item = `ArchiveListItem` (tanpa `documentIds`/`documents`; list tidak di-hydrate) |
| `meta` | `{ page, limit, total }` |

- `search` → OR `like insensitive` ke `name, description`; trim, kosong/<2 char diabaikan (`buildSearch`).
- `filter` value kosong (`filter[status]=`) diabaikan; enum invalid → 422; tanggal non-ISO → 422.
- `sortBy` di luar whitelist → 422 (`assertAllowedSort`).
- Halaman archive memanggil `GET /api/v1/categories?filter[type]=ARCHIVE&limit=100` untuk dropdown kategori (tabel `Category` shared).

### Contoh query

- `GET /api/v1/archives?page=1&limit=20&sortBy=publishedAt&sortOrder=desc&filter[status]=PUBLISHED`
- `GET /api/v1/archives?search=gamelan&sortBy=name&sortOrder=asc`
- `GET /api/v1/archives?filter[type]=MEMBER&filter[status]=PUBLISHED`
- `GET /api/v1/archives?filter[createdAt][gte]=2026-09-01T00:00:00Z`
- `GET /api/v1/archives?mine=true&sortBy=updatedAt&sortOrder=desc`
- `GET /api/v1/categories?filter[type]=ARCHIVE&limit=100`

---

## 9. Link Eksternal & Dokumen PDF (upload S3)

### Link eksternal (`externalLinks`)

- `Archive.externalLinks` = `String[]` (Postgres `TEXT[]`, `@default([])`). Urutan array = urutan tampil.
- **Create/update**: disimpan apa adanya; pada update, `externalLinks` dikirim → **replace seluruh array** (tidak dikirim = jangan sentuh).
- **Response**: dikembalikan **apa adanya** (`["https://...","https://..."]`), tanpa transformasi.
- Validasi `@IsUrl({}, { each: true })` + `@ArrayMaxSize(50)` → 422 bila bukan URL.

### `POST /api/v1/images` — **TIDAK BERUBAH (zero modifications)**

Endpoint, service, processor, dan interceptor image **tidak disentuh sama sekali**. Thumbnail archive hanyalah **URL string** yang dihasilkan dari upload ini.

| Item | Nilai (status quo, jangan diubah) |
| --- | --- |
| Content-Type | `multipart/form-data`, field file `file` |
| Auth | PERMISSION ANY-of `story:create`\|`story:update`\|`event:create`\|`event:update` (`@Permissions('story:create','story:update','event:create','event:update')`) |
| `UploadImageDto.entityType` | `@IsIn(['post'])` |
| `MulterUploadInterceptor` | `ALLOWED_MIME` = png/jpeg/webp (`GIF` **sengaja tidak ada**); `limits.fileSize` = `UPLOAD_MAX_SIZE_MB` (default **5 MB**); `EXT_BY_MIME` = `.png`/`.jpg`/`.webp` |
| `ImageProcessor.process(buffer)` | **signature TIDAK berubah**; pipeline `sharp` as-is (varian webp + `width`/`height` angka) |
| Key S3 | original `posts/original/<uuid>.<ext>` + varian `posts/<uuid>-<name>.webp` |
| Response 201 | `{ data: ImageResponse, message }` |

> **`POST /images` + `ImageService` + `ImageProcessor` + `MulterUploadInterceptor` = tidak berubah.** Tidak ada penambahan `application/pdf`, tidak ada per-mime size, tidak ada `entityType` `'archive'`, tidak ada key prefix `archives/...`, tidak ada perubahan signature `process(buffer, mime)`.

> **Thumbnail archive = URL absolut.** FE mengupload gambar lewat `POST /images` (cara yang sama dengan story), lalu mengirim **URL** hasilnya di field `thumbnail` saat `POST /archives` / `PATCH /archives/:id`. **Tidak ada `imageIds`** dan baris `Image` **tidak** di-bind ke archive (`entityId` tetap `null`).

> **Caveat permission thumbnail.** `POST /images` hanya menerima permission `story:*`/`event:*` (di atas). Aktor yang hanya punya `archive:*` (mis. role archive-only) **tidak bisa** upload thumbnail. Saat ini `admin` memegang semua permission → aman untuk admin-facing. **Upgrade path:** tambah `archive:create`/`archive:update` ke ANY-of `POST /images` **dan/atau** ubah `entityType` `@IsIn([...])`. Keduanya **di luar scope** revisi ini — image wajib unchanged.

> **Orphan akibat thumbnail unbound (TODO).** Baris `Image` thumbnail tetap `entityId = null` (tidak ter-bind). Bila archive dihapus, baris `Image` + objek S3-nya **tidak** ikut terhapus → **orphan cleanup TODO** (sama seperti story). Lihat [story.md §9 Orphan](./story.md#orphan).

### `POST /api/v1/documents` — **BARU (endpoint terpisah, PDF saja)**

| Item | Nilai |
| --- | --- |
| Content-Type | `multipart/form-data`, field file `file` |
| Auth | PERMISSION **ANY-of** `archive:create` \| `archive:update` (`@Permissions('archive:create', 'archive:update')`) |
| `UploadDocumentDto.entityType` | opsional, `@IsIn(['archive'])` (default `'archive'`) |
| Mime diizinkan | **`application/pdf` SAJA** (bukan `application/pdf` di image endpoint — endpoint ini PDF-only). Invalid → **422** |
| Ukuran max | `UPLOAD_DOCUMENT_MAX_SIZE_MB` (default **10**). Invalid/oversize → **422** `{ field: 'file', message }` |
| `DocumentUploadInterceptor` (BARU) | Mirror `MulterUploadInterceptor` tapi **PDF-only + 10 MB**; `ALLOWED_MIME=['application/pdf']`; `limits.fileSize = UPLOAD_DOCUMENT_MAX_SIZE_MB`; error mapping `MulterError LIMIT_FILE_SIZE` → **422** (bukan 400) |
| Pemrosesan | **Tanpa `sharp`**, tanpa varian. Buffer di-put apa adanya |
| Key S3 | `documents/<uuid>.pdf` |
| Response 201 | `{ data: { id, url, key, filename, mimeType, size }, message }` — `url = S3_PUBLIC_BASE_URL + '/' + key` |

Alur `DocumentService.upload`:

1. `DocumentUploadInterceptor` memvalidasi **mime PDF** & **size** dari `@UploadedFile()`; gagal → **422**.
2. Generate key `documents/<uuid>.pdf`.
3. **Tanpa `sharp`.** `StorageService.upload` (S3 `PutObject`) buffer apa adanya.
4. `document.repository.create({ key, filename, mimeType, size, entityType, entityId: null })`.
5. Response `201` `DocumentResponse` (`toDocumentResponse`).

> **`DocumentResponse` shape:** `{ id, url, key, filename, mimeType, size }` — **tanpa** `width`/`height`/`variants` (PDF). Ini kontrak yang dipakai `ArchiveResponse.documents[]`.
> **Dokumen belum ter-bind saat upload** (`entityId = null`); binding terjadi saat `POST /archives` / `PATCH /archives/:id` mengirim `documentIds`.

### Binding ke archive & hapus

- Saat `POST /archives` / `PATCH /archives/:id`, FE mengirim daftar id `Document` lewat `documentIds` (urutan array). Service mem-bind baris `Document` (`entityId = archive.id`, `entityType = 'archive'`) — pola identik galeri story: hanya menyentuh row `entityId=null` atau sudah milik archive ini → **tidak ada shared-row data-loss** (row milik entity lain di-skip/422) ([§7](#7-repository--service)).
- **Replace** (`PATCH`): id dokumen lama yang tak ada di array baru di-unbind (`entityId = null`) dalam transaksi yang sama; `Archive.documentIds` scalar di-set ke urutan baru.
- **Hapus archive** (`DELETE /archives/:id`): `documentRepository.findByEntity('archive', id)` → kumpulkan `key[]` **dulu** → `documentRepository.deleteByEntity('archive', id)` (hapus baris) → `archive.delete` DB → `DeleteObjectsCommand` S3 **best-effort** + `log.warn` bila gagal. S3 setelah DB; kegagalan S3 tidak menggagalkan request.
- **Orphan dokumen**: PDF yang diupload lalu tidak di-bind (`entityId = null`), atau di-unbind saat update, **tidak otomatis terhapus** → TODO cleanup worker (`libs/src/commands/`). Lihat [story.md §9 Orphan](./story.md#orphan).

### Env baru

| Env | Wajib | Default | Keterangan |
| --- | --- | --- | --- |
| `UPLOAD_DOCUMENT_MAX_SIZE_MB` | tidak | `10` | batas ukuran upload dokumen PDF (via `POST /documents`, `DocumentUploadInterceptor`) |

Env S3 (`S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_ENDPOINT`) dipakai ulang dari `StorageService` — tidak ada env baru selain di atas. Tambah validasi Joi (`UPLOAD_DOCUMENT_MAX_SIZE_MB: Joi.number().integer().min(1).default(10)`) di `libs/src/common/config/env.validation.ts`.

---

## 10. Permission & Seed

Permission code baru (lowercase `resource:action`), [rbac.md §4](./rbac.md#4-konvensi-permission-code):

| Resource | Action | Code |
| --- | --- | --- |
| archive | create | `archive:create` |
| archive | read | `archive:read` |
| archive | update | `archive:update` |
| archive | delete | `archive:delete` |
| archive | submit | `archive:submit` |
| archive | approve | `archive:approve` |
| archive | reject | `archive:reject` |
| archive | publish | `archive:publish` |
| archive | unpublish | `archive:unpublish` |

- **Workflow status via endpoint action** ([§5](#5-aturan-status)): `archive:submit` (DRAFT→REQUEST), `archive:approve` (DRAFT|REQUEST→PUBLISHED), `archive:reject` (REQUEST→DRAFT), `archive:publish` (DRAFT|APPROVED→PUBLISHED), `archive:unpublish` (PUBLISHED→DRAFT). `PATCH` (`archive:update`) tetap untuk update konten; scope `all` masih boleh set status/publishedAt langsung.
- **`archive:read`**: baris yang terlihat dibatasi row-level scope ([§6](#6-scoping-baca--tulis)) — `all` → semua; reporter (`create/update/submit`) → miliknya/organisasinya + konten terbit; read-only → hanya konten terbit. `type` (`MEMBER`/`PUBLIC`) **bukan** gerbang row-level; `MEMBER` hanya menyembunyikan payload (`externalLinks`/`documents` → `null`) bila `canViewPrivate=false` **dan** `isMember=false` ([§1](#1-deskripsi--lokasi)).

### Tabel endpoint

Controller `archives.controller.ts` (`@Controller('archives')`, prefix global `/api/v1`):

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/archives` | `archive:create` |
| GET | `/archives` | `archive:read` |
| GET | `/archives/:id` | `archive:read` |
| GET | `/archives/slug/:slug` | `archive:read` — lookup via slug untuk tautan email `/archives/{slug}`; scope baca identik `GET /archives/:id` |
| PATCH | `/archives/:id` | `archive:update` |
| DELETE | `/archives/:id` | `archive:delete` |
| POST | `/archives/:id/submit` | `archive:submit` |
| POST | `/archives/:id/approve` | `archive:approve` |
| POST | `/archives/:id/reject` | `archive:reject` |
| POST | `/archives/:id/publish` | `archive:publish` |
| POST | `/archives/:id/unpublish` | `archive:unpublish` |

Semua action `POST /archives/:id/<action>` `@HttpCode(200)`; `approve`/`publish` menerima body opsional `PublishContentDto` (`publishedAt?`, `notify?` default `true`).

Controller `documents.controller.ts` (`@Controller('documents')`, prefix global `/api/v1`):

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/documents` | ANY-of `archive:create` \| `archive:update` (PDF saja, `multipart/form-data`) |

Endpoint image (reuse image controller yang sudah ada — **TIDAK BERUBAH**):

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/images` | ANY-of `story:create` \| `story:update` \| `event:create` \| `event:update` (thumbnail archive dikirim sebagai URL) |

Categories endpoints **tidak berubah** (`category:*`, shared).

### Seed

- `admin` → **semua** `archive:*` (otomatis dari `DEFAULT_PERMISSIONS`).
- Role bawaan `member`/`author` → `archive:create`, `archive:read`, `archive:update`, `archive:submit` (dikelola sampai REQUEST; tidak bisa delete/approve/reject/publish/unpublish).
- Role `member` → `archive:create`, `archive:read`, `archive:update`, `archive:submit` (tanpa `archive:delete`).
- Role `author` → **sama dengan `member`** (berbagi `MEMBER_PERMISSION_CODES`): `archive:create`, `archive:read`, `archive:update`, `archive:submit`.
- Sidebar menu gate = `admin:access` (seperti Story); route gate = `archive:read`.
- Gerbang FE: menu "Archives" tampil bila user punya `admin:access`; halaman/route dilindungi `archive:read`.

```typescript
// libs/prisma/seed.ts (tambahan ke DEFAULT_PERMISSIONS)
{ code: 'archive:create', description: 'Membuat archive' },
{ code: 'archive:read', description: 'Melihat daftar/detail archive' },
{ code: 'archive:update', description: 'Mengubah archive' },
{ code: 'archive:delete', description: 'Menghapus archive' },
{ code: 'archive:submit', description: 'Mengajukan archive untuk review (DRAFT -> REQUEST)' },
{ code: 'archive:approve', description: 'Menyetujui & menerbitkan archive (DRAFT|REQUEST -> PUBLISHED)' },
{ code: 'archive:reject', description: 'Menolak archive (REQUEST -> DRAFT)' },
{ code: 'archive:publish', description: 'Menerbitkan archive (DRAFT|APPROVED -> PUBLISHED)' },
{ code: 'archive:unpublish', description: 'Menarik archive dari publikasi (PUBLISHED -> DRAFT)' },
```

> Idempotent & additive (`upsert`). `admin` otomatis dari `DEFAULT_PERMISSIONS.map(p => p.code)`. Jalankan `pnpm prisma:seed`.

> **TODO sinkronisasi docs:** tambahkan baris endpoint archive + documents ke [rbac.md §8](./rbac.md#8-ringkasan-endpoint) dan daftar permission di [rbac.md §7](./rbac.md#7-seed-default), serta `archive` ke row-level scoping [rbac.md §10](./rbac.md#10-row-level-scoping). Jangan edit file itu di brief ini.

---

## 11. i18n

**Tidak ada** penanganan i18n di backend untuk iterasi ini. Pesan error/validasi berbahasa Inggris mengikuti pola existing (`Validation failed`, `Forbidden resource`, `Archive not found`). Terjemahan lapisan tampilan menjadi tanggung jawab FE. Bila nanti dibutuhkan, tambahkan resolver locale di `common/` — di luar cakupan brief.

---

## 12. Contoh Response

### Detail archive

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Arsip Penelitian Gamelan 2020",
    "description": "Kumpulan catatan lapangan dan rekaman audio.",
    "thumbnail": "https://cdn.example.com/posts/original/2f9c...ab.jpg",
    "type": "PUBLIC",
    "status": "PUBLISHED",
    "publishedAt": "2026-09-10T10:00:00.000Z",
    "approvedAt": "2026-09-10T10:00:00.000Z",
    "externalLinks": [
      "https://contoh.org/penelitian-gamelan",
      "https://youtu.be/abc123"
    ],
    "creator": { "id": "u-1", "fullName": "Budi" },
    "categories": [{ "id": "c-9", "name": "Penelitian", "type": "ARCHIVE" }],
    "documents": [
      {
        "id": "d-1",
        "url": "https://cdn.example.com/documents/3ab7...f0.pdf",
        "key": "documents/3ab7...f0.pdf",
        "filename": "catatan-lapangan-2020.pdf",
        "mimeType": "application/pdf",
        "size": 524288
      }
    ],
    "createdAt": "2026-09-01T00:00:00.000Z",
    "updatedAt": "2026-09-10T10:00:00.000Z"
  },
  "message": "success"
}
```

### List archive

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Arsip Penelitian Gamelan 2020",
      "description": "Kumpulan catatan lapangan dan rekaman audio.",
      "thumbnail": "https://cdn.example.com/posts/original/2f9c...ab.jpg",
      "type": "PUBLIC",
      "status": "PUBLISHED",
      "publishedAt": "2026-09-10T10:00:00.000Z",
      "approvedAt": "2026-09-10T10:00:00.000Z",
      "externalLinks": [],
      "creator": { "id": "u-1", "fullName": "Budi" },
      "categories": [{ "id": "c-9", "name": "Penelitian", "type": "ARCHIVE" }],
      "createdAt": "2026-09-01T00:00:00.000Z",
      "updatedAt": "2026-09-10T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 },
  "message": "success"
}
```

### Upload dokumen PDF (`POST /documents`)

```json
{
  "data": {
    "id": "d-1",
    "url": "https://cdn.example.com/documents/3ab7...f0.pdf",
    "key": "documents/3ab7...f0.pdf",
    "filename": "catatan-lapangan-2020.pdf",
    "mimeType": "application/pdf",
    "size": 524288
  },
  "message": "success"
}
```

### Tabel Error / Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `POST /archives`, `PATCH /archives/:id` | `UnprocessableEntityException` | 422 | validasi DTO; `documentIds` id tak ada / ter-bind archive lain; `categoryIds` bukan `type=ARCHIVE` |
| `GET/PATCH/DELETE /archives/:id` | `NotFoundException` | 404 | archive tidak ditemukan |
| `GET /archives` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, enum/tanggal invalid |
| `PATCH/DELETE/GET /archives/:id` + `POST /archives/:id/<action>` | `ForbiddenException` | 403 | permission kurang **atau** baris di luar row-level scope ([§6](#6-scoping-baca--tulis)) |
| `POST /archives/:id/<action>` | `ConflictException` | 409 | transisi tidak valid: `Cannot <action> archive in status <STATUS>` |
| `POST /documents` | `UnprocessableEntityException` | 422 | mime bukan `application/pdf` / file > `UPLOAD_DOCUMENT_MAX_SIZE_MB` |
| `POST /documents` | `BadGatewayException` | 502 | `PutObject` ke S3 gagal. Pesan generik, **jangan** bocorkan kredensial. |
| `POST /images` | `UnprocessableEntityException` | 422 | perilaku existing (mime image tidak diizinkan / file > `UPLOAD_MAX_SIZE_MB`) — **tidak berubah** |
| semua | `UnauthorizedException` / `ForbiddenException` | 401 / 403 | JWT invalid / permission kurang |
| semua | `BadRequestException` | 400 | payload/query tidak dapat dipahami |

---

## 13. Status & Catatan

**STATUS: IMPLEMENTED.** Model `Archive`/`ArchiveCategory`/`Document`, migration (`add_archives`, `add_documents`, `add_archive_workflow`), modul `archive`/`document`, controller, dan seed RBAC sudah ada. Archive memakai workflow `DRAFT | REQUEST | APPROVED | PUBLISHED` + row-level scoping (`resource = 'archive'`).

> **Catatan desain (revisi).** Upload **image** dan upload **dokumen** adalah **fungsi/endpoint terpisah**:
> - `POST /images` + `ImageService` + `ImageProcessor` + `MulterUploadInterceptor` → **TIDAK BERUBAH (zero modifications)**: mime png/jpeg/webp, max 5 MB, `entityType` `@IsIn(['post'])`, permission `story:create|story:update|event:create|event:update`, key prefix `posts/...`, pipeline `sharp` as-is.
> - `POST /documents` + `DocumentService` + `DocumentRepository` + `DocumentUploadInterceptor` → **BARU**: tabel `Document` (`documents`) terpisah dari `Image`, PDF saja, max 10 MB (`UPLOAD_DOCUMENT_MAX_SIZE_MB`), key `documents/<uuid>.pdf`, tanpa `sharp`/varian, permission ANY-of `archive:create|archive:update`.
> - `Archive.thumbnail` = **URL string** (upload lewat `POST /images` unchanged). **Tidak ada `imageIds`** di `CreateArchiveDto`; baris `Image` **tidak** di-bind ke archive → orphan cleanup TODO + caveat permission image-upload.
> - `Archive.documentIds` menunjuk baris `Document` (bukan `Image`); detail di-hydrate → `documents: DocumentResponse[]` berurut.

### Pekerjaan selesai

1. **Schema**: enum `ArchiveType`/`ArchiveStatus` (`DRAFT/REQUEST/APPROVED/PUBLISHED`), model `Archive`/`ArchiveCategory`, model **`Document`**; `Archive.approvedAt`; back-relation `Category.archives` + `User.archives`. **`Image` tidak berubah.**
2. **Migration**: `add_archives`, `add_documents`, `add_archive_workflow` (enum + `approved_at`).
3. **Module** `libs/src/modules/archive/` (repo/service/dto/entities) + `libs/src/modules/document/`.
4. **Controller** `archives.controller.ts` (+ endpoint action) + `documents.controller.ts`.
5. **`DocumentUploadInterceptor`** (PDF-only + 10 MB, `LIMIT_FILE_SIZE` → 422). **`ImageProcessor`/`MulterUploadInterceptor`/`ImageService` TIDAK disentuh.**
6. **`AccessScopeService`**: resource `archive` ditambahkan (`CONTENT_RESOURCES`), `resolve(userId, 'archive')` + scoping ([§6](#6-scoping-baca--tulis)).
7. **`POST /documents`**: key `documents/<uuid>.pdf`, response `DocumentResponse`.
8. **Seed**: 9 permission `archive:*`; `member`/`author` mendapat create/update/submit; `admin` all. `pnpm prisma:seed`.
9. **Env**: `UPLOAD_DOCUMENT_MAX_SIZE_MB` (default **10**) + Joi.

### TODO lanjutan

- Cleanup worker orphan: baris `Document` `entityId = null` **dan** baris `Image` thumbnail `entityId = null` (`libs/src/commands/`).
- `slug` unik bila dibutuhkan URL manusiawi.
- **Caveat thumbnail:** bila role archive-only perlu upload thumbnail tanpa `story`/`event` permission, revisi `POST /images` (ANY-of + `entityType` `@IsIn`) — **di luar scope revisi ini** (image wajib unchanged).

### Catatan untuk FE

- Sibling brief FE: **`frontend/docs/module/archive.md`** (belum ada).
- Kontrak penting: `documentIds`/`externalLinks` = array penuh, update **replace** seluruh array. `documents` (= `DocumentResponse[]`) **hanya** di detail `GET /archives/:id`, berurut sesuai `documentIds`; item list **tanpa** `documents`. `documentIds` mentah tidak dikembalikan. `creator.networkId` internal tidak dikembalikan (`creator = { id, fullName }`).
- `PATCH /archives/:id` dengan `"thumbnail": null` menghapus thumbnail.
- **Workflow:** tombol submit (pemilik → `REQUEST`), approve/reject (moderator), publish (`APPROVED → PUBLISHED`), unpublish (`PUBLISHED → DRAFT`). `approve`/`publish` body opsional `{ publishedAt?: ISO8601, notify?: boolean }` (default `notify = true`; `false` → tanpa notifikasi). Transisi tidak valid → **409**.
- `publishedAt` opsional (ISO 8601) → menimpa + paksa `PUBLISHED`; `null` mengosongkan tanggal (hanya scope `all`).
- Upload dokumen PDF lewat **`POST /documents`** (field `file`, mime `application/pdf`, max 10 MB) → kirim `id` di `documentIds` saat create/update archive (bind + urutan); render link dari `url`. Response `DocumentResponse = { id, url, key, filename, mimeType, size }` (tanpa `width`/`height`/`variants`).
- Thumbnail: upload gambar lewat `POST /images` (**tak berubah**), lalu set `thumbnail` = **URL** hasil upload (string). **Tidak ada `imageIds`**. Upload membutuhkan permission image existing (`story:*`/`event:*`; admin memegang semua).
- Menu "Archives" gate `admin:access`; route gate `archive:read`.

## Bulk actions

Bulk routes dideklarasikan sebelum route berparameter `POST /archives/:id/...` dan memakai `@HttpCode(200)`.

| Endpoint | Permission (controller) | Body | Response |
| --- | --- | --- | --- |
| `POST /archives/bulk-status` | `archive:update` | `{ ids: uuid[1..100], status: DRAFT|REQUEST|PUBLISHED }` | `{ updated, skipped, failed }` |
| `POST /archives/bulk-delete` | `archive:delete` | `{ ids: uuid[1..100] }` | `{ deleted, failed }` |

Target status yang diterima hanya `DRAFT`, `REQUEST`, `PUBLISHED`. `APPROVED` ditolak **400** (tak ada transisi yang menghasilkannya; `approve` langsung ke `PUBLISHED`).

Permission transisi (salah satu, dicek di service; di atas `archive:update` di controller):

| Target | Permission | Aksi yang dijalankan |
| --- | --- | --- |
| `REQUEST` | `archive:submit` | `submit` (DRAFT -> REQUEST) |
| `PUBLISHED` | `archive:approve` atau `archive:publish` | `approve` (DRAFT|REQUEST -> PUBLISHED), lalu `publish` (DRAFT|APPROVED -> PUBLISHED) |
| `DRAFT` | `archive:reject` atau `archive:unpublish` | `reject` (REQUEST -> DRAFT), lalu `unpublish` (PUBLISHED -> DRAFT) |

Kandidat aksi dibangun dari permission yang benar-benar dipegang: `reject` hanya bila `archive:reject`, `unpublish` hanya bila `archive:unpublish` (idem `approve`/`publish`). Jadi bulk tidak pernah lebih longgar dari endpoint tunggal `POST /archives/:id/<action>`.

Permission tak memenuhi -> **403**. Setiap id tetap lewat `transition()` (aturan transisi, scope, dan timestamp `approvedAt`/`publishedAt` berlaku).

- `updated`: row benar-benar berubah.
- `skipped`: 404 (row hilang) atau 409 (transisi tidak valid dari status saat ini, termasuk row yang sudah berada di status target) - row tidak diubah.
- `failed`: 403 (scope/izin) atau error lain per-row - row tidak diubah; batch lanjut.

`POST /archives/bulk-delete` memakai `remove()` per id (scope + cleanup storage tetap jalan): `deleted` = berhasil, `failed` = 404/403/error lain. Tidak ada `skipped` karena delete tidak punya konsep "sudah di status target".