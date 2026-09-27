# Module: Archive Submission

Menu: [archive.md](./archive.md) (resource tujuan) · [event-submission.md](./event-submission.md) (pola acuan) · [rbac.md](./rbac.md) (master)

> **STATUS: RENCANA — BELUM DIIMPLEMENTASIKAN.** Tidak ada `schema.prisma` entry, service, repository, controller, DTO, permission seed, maupun migration untuk `ArchiveSubmission` saat dokumen ini ditulis. Semua isi dokumen bersifat **spesifikasi final yang akan diimplementasikan**. Tandai setiap langkah saat mulai mengerjakan. Dokumen ini **hanya brief** — tidak ada kode yang diubah oleh dokumen ini.

---

## 1. Deskripsi & Lokasi

Fitur **Archive Submission**: orang di luar EGS (tanpa akun) mengusulkan archive lewat form publik. Backend menyimpan usulan di tabel tersendiri `archive_submissions`; admin meninjau lewat endpoint admin (approve/reject). **Approve bukan sekadar ubah status**: usulan yang disetujui **di-recreate** menjadi row `Archive` `status=DRAFT`, lalu admin **mengedit + mem-publish** archive tersebut lewat alur publish modul archive yang sudah ada ([archive.md §5](./archive.md#5-aturan-status)). Approve **tidak** langsung menayangkan archive di website EGS.

> **PENTING — tidak ada konflik dengan workflow archive internal.** Modul `archive` **sudah** punya workflow internal terautentikasi (`archive:submit` DRAFT → REQUEST → approve/reject/publish/unpublish, [archive.md §5](./archive.md#5-aturan-status)). `archive-submission` adalah **tabel & jalur terpisah** untuk submitter eksternal anonim. Fitur ini **TIDAK** mengubah, memodifikasi, atau menggantikan workflow internal itu. Approve submission publik membuat `Archive` `DRAFT` dan **melewati** `archive:submit` (tidak ada transisi ke `REQUEST`); admin mengedit lalu mem-publish via `archive:publish`.

**Semua submission yang masuk adalah publik anonim** dan muncul di dashboard admin. Dashboard admin tidak memakai endpoint baru: ia mengonsumsi list admin `GET /archive-submissions` yang difilter `status` (§5.3).

Karakteristik:

- **Satu jalur: publik anonim** — `POST /archive-submissions` (form website EGS, `@Public()`), memakai `CreateArchiveSubmissionDto`, menghasilkan `status=REQUEST`, dan masuk antrean review admin (approve/reject).
- **Tanpa autentikasi** untuk endpoint publik (`POST /archive-submissions`, `POST /archive-submissions/thumbnail`, `POST /archive-submissions/attachments`).
- **Tabel terpisah** dari `archives` saat submit; approve membuat `Archive` `DRAFT` dan menautkannya via `ArchiveSubmission.archiveId` (§5.2.1). Submission **tidak dihapus** setelah approve — tetap tersimpan sebagai audit (`status=APPROVED`, `archiveId` terisi).
- Status: `REQUEST` (default) → `APPROVED` / `REJECTED` (final). Hanya `APPROVED` yang membuat `Archive` (`DRAFT`); `REJECTED` tidak.
- **Field submission**: `name`, `description`, `thumbnail`, `externalLinks`, `attachments` (array id baris `Document` PDF, berurut; diupload lewat `POST /archive-submissions/attachments`, §5.1). Tanpa `categoryIds`, tanpa identitas submitter.
- Thumbnail disimpan sebagai URL hasil upload (`POST /archive-submissions/thumbnail`), bukan binary. PDF disimpan sebagai baris `Document` (`entityType='archive-submission'`, `entityId=null`) dan id-nya dikirim di `attachments`.

### Lokasi kode (rencana)

```
libs/src/modules/archive-submission/
├── archive-submission.repository.ts
├── archive-submission.service.ts
├── archive-submission.module.ts
├── dto/
│   ├── create-archive-submission.dto.ts
│   ├── review-archive-submission.dto.ts
│   └── list-archive-submissions-query.dto.ts
└── entities/
    └── archive-submission.entity.ts

apps/app/src/controllers/
└── archive-submissions.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

Alur baku `Controller → Service → Repository → Prisma`; repository satu-satunya tempat query Prisma (RULES bab 3). Modul didaftarkan di `libs/src/libs.module.ts` (imports + exports) dan controller di `apps/app/src/app.module.ts` — mengikuti modul `event-submission`.

Perubahan file existing (rencana):

| File | Perubahan |
| --- | --- |
| `libs/prisma/schema.prisma` | tambah `enum ArchiveSubmissionStatus` + `model ArchiveSubmission` (+ scalar `attachmentIds String[]`, relasi `archiveId` ke `Archive`) + back-relation `Archive.submission` (§2). Migration baru `add_archive_submissions`. |
| `libs/prisma/seed-data.ts` + `libs/prisma/seed.ts` | tambah **3** permission `archive-submission:*` (`read`/`approve`/`reject`) ke `DEFAULT_PERMISSIONS` + naikkan hitungan `rbac.md` §7 (65 → 68). |
| `libs/src/modules/image/dto/upload-image.dto.ts` | tambah `'archive-submission'` ke `@IsIn` `UploadImageDto` (§5). |
| `libs/src/libs.module.ts` | daftar `ArchiveSubmissionModule` (imports/exports). |
| `apps/app/src/app.module.ts` | daftar `ArchiveSubmissionsController`. |
| `libs/src/modules/archive-submission/archive-submission.module.ts` | impor `ArchiveModule` + `ImageModule` + **`DocumentModule`** (approve memakai `ArchiveService`; thumbnail memakai `ImageService`; upload attachment + hydrate memakai `DocumentService`/`DocumentRepository`). |
| `libs/src/common/interceptors/document-upload.interceptor.ts` | **dipakai ulang apa adanya** — `DocumentUploadInterceptor` sudah generik (PDF-only, `UPLOAD_DOCUMENT_MAX_SIZE_MB`, field `file`, error → 422), **tidak perlu perubahan**. (Bila ternyata hardcode/serve hanya archive, parameterisasi; kondisi saat ini tidak.) |
| `libs/src/modules/archive/archive.service.ts` + `archive.repository.ts` | **(bersyarat, wajib untuk approve atomik)** tambah parameter opsional `tx` pada `create` agar `ArchiveService.create` bisa ikut transaksi pemanggil (§5.2.1). |
| env | pakai ulang `UPLOAD_DOCUMENT_MAX_SIZE_MB` (default `10`) untuk attachment publik — **tidak ada env baru**. |
| `backend/docs/modules/rbac.md` §7 | update hitungan `DEFAULT_PERMISSIONS` (65 → 68, +3); ketiga code `archive-submission:*` admin-only. |

---

## 2. Model Prisma

**Belum ada.** Tambahkan ke `libs/prisma/schema.prisma` (satu-satunya sumber entity, RULES bab 4):

```prisma
enum ArchiveSubmissionStatus {
  REQUEST
  APPROVED
  REJECTED
}

model ArchiveSubmission {
  id            String                  @id @default(uuid())
  name          String
  description   String?
  thumbnail     String?
  externalLinks String[]                @default([]) @map("external_links")
  // id baris Document, berurut (mirror Archive.documentIds). Scalar String[] menunjuk
  // Document — BUKAN relasi Prisma.
  attachmentIds String[]                @default([]) @map("attachment_ids")
  status        ArchiveSubmissionStatus @default(REQUEST)
  adminNote     String?                 @map("admin_note")
  reviewedBy    String?                 @map("reviewed_by")
  reviewedAt    DateTime?               @map("reviewed_at")
  archiveId     String?                 @unique @map("archive_id")
  archive       Archive?                @relation(fields: [archiveId], references: [id], onDelete: SetNull)
  createdAt     DateTime                @default(now()) @map("created_at")
  updatedAt     DateTime                @updatedAt @map("updated_at")

  @@index([status])
  @@map("archive_submissions")
}
```

**Back-relation yang wajib ditambahkan** (tanpa ini `prisma validate` gagal):

```prisma
model Archive {  // tambah baris
  submission ArchiveSubmission?
}
```

Catatan:

- `archiveId @unique` + `archive` relasi opsional (`onDelete: SetNull`) → satu submission hanya boleh menunjuk satu `Archive`; approve ganda tidak bisa membuat `Archive` dobel (idempotensi, §5.2.1). `SetNull` → hapus `Archive` tidak menghapus submission (jejak audit tetap), `archiveId` jadi null.
- `reviewedBy` **scalar tanpa relasi** ke `User` (disengaja; kolom audit saja). Bila review-user perlu di-join, tambahkan relasi terpisah di iterasi lain.
- `externalLinks` = `String[]` (Postgres `TEXT[]`, default `[]`); urutan array = urutan tampil.
- `attachmentIds` = `String[]` (Postgres `TEXT[]`, default `[]`); **scalar penunjuk id baris `Document`**, berurut, **bukan** relasi Prisma (mirror `Archive.documentIds`). Diisi dari hasil `POST /archive-submissions/attachments` (id yang divalidasi `entityType='archive-submission'` & `entityId=null`). Nilai mentah **tidak** dibocorkan ke API — list memakai `attachmentCount`, detail di-hydrate `attachments` (§3).
- `archiveId` + relasi hanya ditulis saat approve; tidak ada field kategori/identitas submitter (§9.3).
- Migration baru diperlukan: `pnpm prisma migrate dev --name add_archive_submissions` (ikuti konvensi nama migration repo), lalu `pnpm prisma:generate`.

---

## 3. Entity Payload

Ikuti RULES bab 4 (satu `select` + `Prisma.GetPayload`). Dua view: list admin & detail. Relasi `archive` hanya butuh rujukan minimal (`{ id, status }`) — tidak ada join berat.

```typescript
// libs/src/modules/archive-submission/entities/archive-submission.entity.ts
import { Prisma } from '@prisma/client';
import type { DocumentResponse } from '@app/libs/modules/document/document.service';

export const archiveSubmissionSelect = {
  id: true,
  name: true,
  description: true,
  thumbnail: true,
  externalLinks: true,
  attachmentIds: true,
  status: true,
  adminNote: true,
  reviewedBy: true,
  reviewedAt: true,
  archiveId: true,
  createdAt: true,
  updatedAt: true,
  archive: { select: { id: true, status: true } },
} satisfies Prisma.ArchiveSubmissionSelect;

export type ArchiveSubmissionPayload = Prisma.ArchiveSubmissionGetPayload<{
  select: typeof archiveSubmissionSelect;
}>;

// Mapper mapArchiveSubmission() flatten join `archive` (null bila belum ditautkan).
// `attachmentIds` (scalar) tetap di entity internal — dipakai saat approve & hydrate detail.
export type ArchiveSubmissionEntity = Omit<ArchiveSubmissionPayload, 'archive'> & {
  archive: { id: string; status: string } | null;
};

// Item LIST: buang `attachmentIds` mentah (tanpa lookup dokumen); ekspos `attachmentCount`.
export type ArchiveSubmissionListItem = Omit<ArchiveSubmissionEntity, 'attachmentIds'> & {
  attachmentCount: number;
};

// DETAIL: `attachmentIds` mentah diganti `attachments` hasil resolusi berurut (DocumentResponse).
export type ArchiveSubmissionResponse = Omit<ArchiveSubmissionListItem, 'attachmentCount'> & {
  attachments: DocumentResponse[];
};
```

`mapArchiveSubmission()` mem-flatten `archive` → `{ id, status }` (null bila kosong), mengikuti pola `mapEventSubmission()`. Join shape mentah tidak bocor ke service/controller. List admin **wajib** menyertakan rujukan `archive` (id + status), bukan hanya `archiveId`.

- **List**: `attachmentCount = attachmentIds.length`; `attachmentIds` mentah dibuang. Tanpa lookup dokumen (murah, hindari N+1 — mirror `ArchiveService.toListItem`).
- **Detail** (`GET /archive-submissions/:id`): `attachmentIds` diselesaikan via `DocumentRepository.findByIds` + `DocumentService.toDocumentResponse`, hasil `attachments: DocumentResponse[]` **berurut** sesuai `attachmentIds`. Raw `attachmentIds` tidak dikembalikan — **mirror `ArchiveService.hydrate`**.
- **Approve/reject** memakai bentuk **item list** (`ArchiveSubmissionListItem`), bukan entity mentah: hook `approve`/`reject` di service meng-map hasil repository lewat `toListItem`, sehingga `submission` pada respons juga **tanpa** `attachmentIds` dan **dengan** `attachmentCount` (§5.2.1). Detail (`GET /:id`) tetap ter-hydrate `attachments`; bentuk list tidak dipakai di sana.
- **Catatan approve & `entityType` dokumen**: `DocumentRepository.bind` memfilter `entityType`, jadi baris attachment submission (`entityType='archive-submission'`) **wajib** di-`reassignEntityType` → `'archive'` sebelum `ArchiveService.create` (§5.2.1).

---

## 4. DTO

### `CreateArchiveSubmissionDto`

File: `libs/src/modules/archive-submission/dto/create-archive-submission.dto.ts`. Tiru pola `CreateArchiveDto` (RULES bab 4).

| Field | Aturan |
| --- | --- |
| `name` | `@Transform(({ value }) => value?.trim())`, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `description` | opsional `@IsString()` (teks biasa, bukan rich HTML) |
| `thumbnail` | opsional `@IsString()`, `@MaxLength(2048)` |
| `externalLinks` | opsional `@IsArray()`, `@IsUrl({}, { each: true })`, `@ArrayMaxSize(50)` |
| `attachments` | opsional `@IsArray()`, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(20)`. Id = hasil `POST /archive-submissions/attachments`, **berurut**. Service wajibkan tiap id ada, `entityType='archive-submission'`, `entityId=null`; melanggar → **422** `{ field: 'attachments.N', message }` (§5.1) |

`forbidNonWhitelisted` (§8 poin 2) **menolak** body yang menyertakan `status`/`reviewedBy`/`archiveId`/`categoryIds`/`documentIds` dengan **422**; klien tidak dapat menyuntik field server-derived. `documentIds` **tetap** ditolak (nama field beda) — field publik untuk PDF adalah `attachments`, idnya berasal dari endpoint upload publik, bukan dari body.

> **Sengaja TIDAK ada** `categoryIds` (admin menetapkan kategori pada `Archive` `DRAFT` setelah approve) dan identitas/contact submitter (`Archive` tidak punya padanan organiser/org; `reviewedBy`/`reviewedAt` tetap sebagai audit). **PDF publik sekarang DIDUKUNG** lewat `attachments` (id baris `Document` dari `POST /archive-submissions/attachments`) — lihat §9.3 untuk batas abuse/mitigasi.

### Contoh payload request

```json
{
  "name": "Arsip Penelitian Gamelan Bali",
  "description": "Kumpulan catatan lapangan dan dokumentasi audio.",
  "thumbnail": "https://cdn.example.com/posts/original/abc.jpg",
  "externalLinks": ["https://contoh.org/penelitian-gamelan", "https://youtu.be/abc123"],
  "attachments": [
    "9c1d2e3f-0000-1111-2222-333344445555",
    "a1b2c3d4-5555-6666-7777-888899990000"
  ]
}
```

### Contoh 422 (validasi per-field)

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    { "field": "name", "message": "name should not be empty" },
    { "field": "externalLinks.0", "message": "each value in externalLinks must be an URL address" },
    { "field": "attachments.0", "message": "attachment not found, wrong type, or already bound" }
  ]
}
```

### `ReviewArchiveSubmissionDto`

File: `libs/src/modules/archive-submission/dto/review-archive-submission.dto.ts`. Mirror `ReviewEventSubmissionDto`.

```typescript
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewArchiveSubmissionDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
```

### `ListArchiveSubmissionsQueryDto`

File: `libs/src/modules/archive-submission/dto/list-archive-submissions-query.dto.ts`. Kosong, mewarisi `ListQueryDto` (whitelist filter/sort di service, §5.3).

```typescript
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListArchiveSubmissionsQueryDto extends ListQueryDto {}
```

---

## 5. Endpoint

Semua path prefix **`/api/v1`** (RULES bab 1). Sukses `{ data, message }`; list `{ data, meta, message }`; error `{ statusCode, message, errors }` (RULES bab 5).

### 5.1 PUBLIK (`@Public()`, tanpa RBAC)

**`@Public()` = bypass penuh deny-by-default.** Guard `JwtAuthGuard` dan `PermissionsGuard` (rbac.md §6) melewatkan endpoint `@Public()` tanpa JWT **dan** tanpa cek metadata `@Permissions` — jadi **tidak ada permission yang dibutuhkan** untuk submit publik. Menambah `@Permissions` pada endpoint `@Public()` tidak berefek (guard sudah lolos lebih dulu) — jangan lakukan.

| Method | Path | Deskripsi | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/archive-submissions` | Buat usulan archive, `status=REQUEST` | `CreateArchiveSubmissionDto` (JSON) | 201 `{ data: { id, status }, message }` |
| POST | `/api/v1/archive-submissions/thumbnail` | Upload thumbnail usulan | multipart `file` | 201 `{ data: ImageResponse, message }` |
| POST | `/api/v1/archive-submissions/attachments` | Upload **PDF** attachment usulan | multipart `file` (`application/pdf`) | 201 `{ data: DocumentResponse, message }` |

- `POST /archive-submissions` → service `create()` men-set `status=REQUEST`, lalu balikan **hanya** `{ id, status }` (bukan seluruh row/PII echo, §8 poin 11). Throttle ~**5/menit** (`ThrottlerGuard` + `@Throttle`, mirror event-submission). 422 validasi per-field. Bila `attachments` dikirim, service memvalidasi tiap id sebelum insert (§4).
- `POST /archive-submissions/thumbnail` → panggil `ImageService.upload(file, 'archive-submission')`; **hardcode** `entityType` di controller, **jangan** terima dari body publik. Throttle ~**10/menit**. Balikan `ImageResponse` (`{ id, url, key, filename, mimeType, size, width, height, variants[] }` — bentuk `ImageService.toImageResponse`). Key S3 memakai prefix existing `posts/...` (image service tidak diubah).
- `POST /archive-submissions/attachments` → `@Public()` + `@UseGuards(ThrottlerGuard)` + `@Throttle({ default: { limit: 10, ttl: 60_000 } })` (mirror thumbnail) + `@UseInterceptors(DocumentUploadInterceptor)`. Controller memanggil `DocumentService.upload(file, 'archive-submission')` — **`entityType` di-hardcode server-side**, body `entityType` **tidak** diterima dari publik. PDF-only + max `UPLOAD_DOCUMENT_MAX_SIZE_MB` (10) ditegakkan interceptor + `DocumentService` (magic-byte `%PDF-`). Balikan 201 `{ data: DocumentResponse, message }`, `DocumentResponse = { id, url, key, filename, mimeType, size }` (**tanpa** `width`/`height`/`variants`). Bentuk sama dengan `POST /documents` existing, hanya publik + `entityType='archive-submission'`. Baris `Document` tersimpan `entityId=null` (belum ter-bind); FE mengirim id-nya lewat `attachments` saat `POST /archive-submissions`.

Contoh respons 201 (**hanya** `{ id, status }` — tanpa echo row/PII):

```json
{
  "data": { "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "status": "REQUEST" },
  "message": "success"
}
```

> Data lengkap (name, description, link, dll) **tidak** dikembalikan ke pemanggil anonim; admin membacanya lewat `GET /archive-submissions` (§5.2).

Contoh respons upload thumbnail:

```json
{
  "data": {
    "id": "9c1d2e3f-0000-1111-2222-333344445555",
    "url": "https://cdn.example.com/posts/abc-large.webp",
    "key": "posts/original/abc.jpg",
    "filename": "arsip.jpg",
    "mimeType": "image/jpeg",
    "size": 204800,
    "width": 1600,
    "height": 900,
    "variants": [
      { "name": "thumbnail", "url": "https://cdn.example.com/posts/abc-thumb.webp" },
      { "name": "large", "url": "https://cdn.example.com/posts/abc-large.webp" }
    ]
  },
  "message": "success"
}
```

Contoh respons upload attachment (PDF):

```json
{
  "data": {
    "id": "9c1d2e3f-0000-1111-2222-333344445555",
    "url": "https://cdn.example.com/documents/abc.pdf",
    "key": "documents/abc.pdf",
    "filename": "laporan-penelitian.pdf",
    "mimeType": "application/pdf",
    "size": 1048576
  },
  "message": "success"
}
```

### 5.2 ADMIN (auth + permission)

| Method | Path | Permission | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/archive-submissions` | `archive-submission:read` | `ListArchiveSubmissionsQueryDto` | 200 `{ data, meta, message }` |
| GET | `/api/v1/archive-submissions/:id` | `archive-submission:read` | `id` UUID (`ParseUUIDPipe`) | 200 `{ data, message }` |
| POST | `/api/v1/archive-submissions/:id/approve` | `archive-submission:approve` | body opsional `{ adminNote? }` | 200 `{ data: { submission, archive: { id, status: 'DRAFT' } }, message }` |
| POST | `/api/v1/archive-submissions/:id/reject` | `archive-submission:reject` | body `{ adminNote? }` | 200 `{ data, message }` |

- `GET /archive-submissions` — list paginasi + search + sort (kontrak §5.3). **Dashboard admin memakai endpoint ini** (tanpa endpoint dashboard/stats baru): `GET /archive-submissions?filter[status]=REQUEST`; jumlah cukup dibaca dari `meta.total` per filter. Controller mengembalikan `{ data: items, meta: { page, limit: Math.min(query.limit ?? 20, 100), total } }` (ikuti `event-submissions.controller.ts`).
- `GET /archive-submissions/:id` — `ParseUUIDPipe`; tidak ada → 404 `NotFoundException('Archive submission not found')`. **Hydrate** `attachments: DocumentResponse[]` berurut via `DocumentRepository.findByIds` + `DocumentService.toDocumentResponse` (mirror `ArchiveService.hydrate`); raw `attachmentIds` **tidak** dikembalikan.
- `GET /archive-submissions` (list) — item memakai `attachmentCount` (`attachmentIds.length`), **tanpa** hydrate dokumen; raw `attachmentIds` **tidak** dikembalikan (hindari N+1).
- `POST .../approve` — **membuat `Archive` `status=DRAFT`** dalam satu transaksi (alur lengkap §5.2.1). Response menyertakan `archive.id` agar FE admin dapat **redirect ke `/archives/:id/edit`**. Body opsional `{ adminNote? }`.
- `POST .../reject` — set `status=REJECTED`, `reviewedBy=user.id`, `reviewedAt=now`. Body `{ adminNote? }`. **Tidak** membuat `Archive`.
- Perubahan status pada row yang **sudah final** (`APPROVED`/`REJECTED`) → **409** `ConflictException` (mis. `Cannot approve archive submission in status APPROVED`). Conditional update (`updateMany` dengan `where: { id, status: REQUEST }`) menutup race, mengikuti pola `EventSubmissionRepository` (event-submission.md §5.2).

#### 5.2.1 `POST /:id/approve` — alur transaksional (approve → insert `archives` sebagai `DRAFT`)

**Wajib** dibungkus `prisma.$transaction` agar `Archive` + tautan `archiveId` atomik. Urutan:

1. **Conditional update** `archiveSubmission.updateMany({ where: { id, status: 'REQUEST' }, data: { status: 'APPROVED', reviewedBy, reviewedAt: now, adminNote? } })`. `count === 0` → **404** (row tidak ada) atau **409** (sudah final) — bedakan dengan `findUnique` bila perlu pesan akurat (pola `updateStatusFinal` event-submission).
2. **Buat `Archive`**: pakai `ArchiveService.create(...)` di dalam transaksi. **Signature existing berbeda dari contoh brief** — kode nyata: `ArchiveService.create(dto: CreateArchiveDto, userId: string): Promise<ArchiveResponse>` (`libs/src/modules/archive/archive.service.ts`). Panggilan persis:

   ```typescript
   // WAJIB sebelum create: `DocumentRepository.bind` memfilter `entityType`, sehingga baris
   // attachment ber-`entityType='archive-submission'` tidak akan ter-bind ke archive. Pindahkan
   // ownership-nya ke `entityType='archive'` (entityId tetap null) via reassignEntityType.
   await this.documentRepository.reassignEntityType(
     submission.attachmentIds,
     'archive-submission',
     'archive',
     tx,
   );

   const archive = await this.archiveService.create(
     {
       name: submission.name,
       description: submission.description ?? undefined,
       thumbnail: submission.thumbnail ?? undefined,
       externalLinks: submission.externalLinks,
       status: ArchiveStatus.DRAFT,
       // PDF yang diupload publik disalin ke Archive — urutan dipertahankan.
       // Baris sudah `entityType='archive'`, `entityId=null` (setelah reassign), jadi bind sukses.
       documentIds: submission.attachmentIds,
       // type / categoryIds / publishedAt TIDAK dikirim:
       // type default PUBLIC, kategori diisi admin pada DRAFT setelah approve.
     },
     reviewerUserId,
     tx,
   );
   ```

   Admin punya scope `all`, jadi `ArchiveService.create` tidak memaksa status (blok `scope.kind !== 'all'` dilewati) dan `status: DRAFT` dihormati. `publishedAt`/`approvedAt` tetap null. **Jangan** tulis raw cross-module Prisma.

   > **Binding PDF saat approve.** `ArchiveRepository.create` memanggil `DocumentRepository.bind(documentIds, 'archive', archiveId, tx)` (§ archive.md §7). **Penting:** `bind` memfilter `entityType` — ia hanya mengambil row dengan `entityType='archive'` yang `entityId=null`/sudah milik archive ini. Baris attachment submission tersimpan `entityType='archive-submission'`, sehingga **tidak** akan ter-bind secara otomatis. Karena itu approve **wajib** memanggil `DocumentRepository.reassignEntityType(submission.attachmentIds, 'archive-submission', 'archive', tx)` lebih dulu (mengubah `entityType` row, `entityId` tetap `null`) sebelum `ArchiveService.create`. Klaim lama "bind sukses otomatis karena `entityId=null`" **tidak akurat** dan dihapus. `ArchiveService.create` juga perlu `tx` threading (§5.2.1 kendala atomisitas). **Wajib** diteruskan `documentIds: submission.attachmentIds` (bukan array kosong) agar PDF ikut pindah.

   > **Kendala atomisitas (wajib ditangani):** `ArchiveService.create` saat ini **membuka `prisma.$transaction` sendiri** (`archive.repository.ts` → `this.prisma.$transaction`), sehingga tidak bisa di-nest ke transaksi approve. Agar langkah 1–3 tetap satu transaksi dengan rollback (persyaratan §5.2.1), tambahkan parameter opsional `tx?: Prisma.TransactionClient` ke `ArchiveService.create` + `ArchiveRepository.create`, dan teruskan `tx` ke `DocumentRepository.bind` yang sudah tx-aware. Tanpa perubahan ini approve **tidak atomik** (Archive dibuat, submission gagal di-taut → Archive yatim). Perubahan ini kecil & additive; entry ada di tabel §1.

3. **Tautkan submission**: `archiveId = archive.id` (bagian dari langkah 1 atau `update` lanjutan di dalam `tx`).
4. **Respons**: `{ data: { submission, archive: { id, status: 'DRAFT' } }, message }`. `Archive` **tidak punya `slug`** ([archive.md §2](./archive.md#2-model-prisma)) → rujukan cukup `archive.id`; FE admin redirect ke `/archives/:id/edit`.
5. **Gagal di tengah → rollback**; submission tetap `REQUEST`, tidak ada `Archive` yatim; balas **500** (error tak terduga).

> `ponytail:` satu transaksi DB cukup sebagai penjaga race + atomisitas; `archiveId @unique` + conditional update `status: REQUEST` menjamin idempotensi. Jangan bangun saga/outbox.

> **Publikasi setelah approve.** `Archive` hasil approve berstatus `DRAFT`; **publikasi bukan bagian dari approve**. PDF dari submission **sudah ikut ter-bind** saat approve (`documentIds = submission.attachmentIds`, §5.2.1). Admin mengeditnya lewat modul archive existing (`PATCH /archives/:id`, `archive:update`) — termasuk menetapkan `categoryIds` dan menambah/menghapus PDF via `POST /documents` + `documentIds` (replace seluruh array; id yang dilepas di-unbind) — lalu mem-publish lewat `POST /archives/:id/publish` (`archive:publish`, `APPROVED → PUBLISHED`). Karena dibuat langsung `DRAFT` (bukan `REQUEST`), alur `archive:submit` **dilewati**. `archive:publish` hanya dimiliki admin → tidak ada eskalasi hak. Perlu dicatat: `ARCHIVE_TRANSITIONS.publish` existing ber-`from: APPROVED`; untuk jalur `DRAFT → PUBLISHED` ini, gunakan `archive:update`/`PATCH` oleh admin (scope `all` boleh set `status`) atau tambahkan `DRAFT` ke `from` `publish` (keputusan implementasi, lihat §9.4).

**Tabel mapping field (submission → `Archive`)**

| Submission | Archive | Catatan |
| --- | --- | --- |
| `name` | `name` | langsung. |
| `description` | `description` | teks biasa (bukan HTML) — tidak ada escaping HTML diperlukan. |
| `thumbnail` | `thumbnail` | URL storage EGS (§8 poin 4). |
| `externalLinks` | `externalLinks` | disalin apa adanya (urut). |
| `status` (`APPROVED`) | `status` | `DRAFT`. `publishedAt`/`approvedAt` null. |
| `reviewedBy` | `createdBy` | admin penyetuju (submission tak punya `User`). |
| `attachmentIds` | `documentIds` | disalin apa adanya (**urutan dipertahankan**); `ArchiveService.create` mem-bind baris `Document` ke archive baru. |
| — | `type` | default `PUBLIC` (tidak dikirim dari submission). |
| — | `categoryIds` | **tidak** disalin; diisi admin pada `DRAFT` setelah approve (§9.3). |

Keterbatasan & keputusan:

- **Idempotensi**: `ArchiveSubmission.archiveId @unique` (§2) + conditional update `status: REQUEST` → approve ganda tidak menghasilkan `Archive` dobel.
- Submission tetap tersimpan sebagai audit (`status=APPROVED`, `archiveId` terisi); tidak dihapus.
- `Archive` tanpa `slug` — response memakai `archive.id`.

**Respons approve**:

```json
{
  "data": {
    "submission": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "status": "APPROVED",
      "archiveId": "b7e2c1a0-...",
      "attachmentCount": 2,
      "adminNote": "Sumber terverifikasi.",
      "reviewedBy": "d290f1ee-...",
      "reviewedAt": "2026-09-27T08:00:00.000Z"
    },
    "archive": { "id": "b7e2c1a0-...", "status": "DRAFT" }
  },
  "message": "success"
}
```

### 5.3 Kontrak List Admin (RULES bab 19/19a/19b)

Konstanta di-export dari `archive-submission.service.ts`:

| Konstanta | Nilai |
| --- | --- |
| `ARCHIVE_SUBMISSION_SEARCHABLE_FIELDS` | `['name', 'description']` |
| `ARCHIVE_SUBMISSION_SORT_FIELDS` | `['name', 'status', 'createdAt', 'updatedAt']` |
| `ARCHIVE_SUBMISSION_FILTER_FIELDS` | `['status', 'reviewedAt', 'createdAt', 'updatedAt']` |
| `ARCHIVE_SUBMISSION_DATE_FIELDS` | `['reviewedAt', 'createdAt', 'updatedAt']` |

- `search` di-trim; `<2 char` diabaikan (`buildSearch`); `>100 char` → 422.
- `sortBy` tak dikenal → 422 (`assertAllowedSort`). Default `sortBy=createdAt&sortOrder=desc`.
- `filter[status]=REQUEST` (enum `REQUEST|APPROVED|REJECTED`), `filter[createdAt][gte]=...`, `filter[reviewedAt][lte]=...`.
- `:id` pakai `ParseUUIDPipe`.

Contoh query:

```
GET /api/v1/archive-submissions?page=1&limit=20&sortBy=createdAt&sortOrder=desc&filter[status]=REQUEST&search=gamelan
```

```json
{
  "data": [
    {
      "id": "3fa85f64-...",
      "name": "Arsip Penelitian Gamelan Bali",
      "description": "Kumpulan catatan lapangan dan dokumentasi audio.",
      "thumbnail": null,
      "externalLinks": ["https://contoh.org/penelitian-gamelan"],
      "attachmentCount": 2,
      "status": "REQUEST",
      "adminNote": null,
      "reviewedBy": null,
      "reviewedAt": null,
      "archiveId": null,
      "archive": null,
      "createdAt": "2026-09-26T10:00:00.000Z",
      "updatedAt": "2026-09-26T10:00:00.000Z"
    }
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
| `POST /archive-submissions` | `UnprocessableEntityException` | 422 | validasi DTO per-field; `thumbnail` bukan milik storage EGS (§8.4); `attachments.N` tak ada / bukan `entityType='archive-submission'` / sudah ter-bind (`entityId != null`) |
| `POST /archive-submissions` | `ConflictException` | 409 | duplikat identik (`name`) dalam window singkat (§8.7) |
| `POST /archive-submissions/thumbnail` | `UnprocessableEntityException` | 422 | file hilang / MIME tak didukung / terlalu besar (dari `ImageService`) |
| `POST /archive-submissions/attachments` | `UnprocessableEntityException` | 422 | file hilang / bukan PDF (mime + magic byte `%PDF-`) / terlalu besar (dari `DocumentUploadInterceptor` + `DocumentService`) |
| `GET /archive-submissions` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, enum/tanggal invalid |
| `GET /archive-submissions/:id` | `BadRequestException` | 400 | `:id` bukan UUID (`ParseUUIDPipe`) |
| `GET /archive-submissions/:id` | `NotFoundException` | 404 | submission tidak ada |
| `POST /:id/approve`, `/:id/reject` | `ConflictException` | 409 | row sudah final (`APPROVED`/`REJECTED`) — `Cannot <action> archive submission in status <STATUS>` |
| `POST /:id/approve`, `/:id/reject` | `NotFoundException` | 404 | submission tidak ada |
| `POST /:id/approve` | `InternalServerErrorException` | 500 | gagal saat transaksi insert `Archive` `DRAFT` → rollback, submission tetap `REQUEST` (§5.2.1) |
| admin endpoints | `UnauthorizedException` / `ForbiddenException` | 401 / 403 | JWT invalid / permission kurang |
| `POST /archive-submissions*` | `HttpException` (429) | 429 | rate limit terlampaui (§8 poin 1) |

Contoh 409:

```json
{ "statusCode": 409, "message": "Cannot approve archive submission in status APPROVED", "errors": [] }
```

---

## 7. Permission

Seed di `libs/prisma/seed-data.ts` (`DEFAULT_PERMISSIONS`, dikonsumsi `libs/prisma/seed.ts`; rujuk [rbac.md §7](./rbac.md#7-seed-default)). Konvensi `resource:action` lowercase (rbac.md §4).

| Code | Deskripsi | admin | organization | member |
| --- | --- | :---: | :---: | :---: |
| `archive-submission:read` | Lihat daftar/detail usulan archive | ✅ | — | — |
| `archive-submission:approve` | Setujui + recreate konten ke tabel `archives` sebagai `DRAFT` (bukan publish) | ✅ | — | — |
| `archive-submission:reject` | Tolak usulan | ✅ | — | — |

- Seed **3** code `archive-submission:*`, semuanya **admin-only** (tidak diberikan ke `organization`/`member`).
- `admin` otomatis mendapat semua code (`DEFAULT_PERMISSIONS.map`).
- Endpoint publik (`POST /archive-submissions`, `POST /archive-submissions/thumbnail`) tetap `@Public()` → **bypass deny-by-default**, jadi **tidak butuh** permission apa pun (§5.1). Submit publik murni anonim — tidak ada permission `create`.
- Update hitungan `DEFAULT_PERMISSIONS` di `rbac.md` §7 (**65 → 68**, +3). `pnpm prisma:seed` idempoten.

---

## 8. Keamanan & Anti-Spam

**Rencana.** Endpoint tulis publik tanpa auth = permukaan serangan terbuka. Pertahanan konkret (per poin, wajib ditandai saat implementasi). `ThrottlerModule` **sudah ada** di `apps/app/src/app.module.ts` (global) — cukup pakai `@UseGuards(ThrottlerGuard)` + `@Throttle` per route (tidak perlu tambah dep).

1. **Rate limit** — `POST /archive-submissions` (~**5/menit**) + `POST /archive-submissions/thumbnail` (~**10/menit**) + `POST /archive-submissions/attachments` (~**10/menit**), per-IP, mirror event-submission. **Wajib** `app.set('trust proxy', 1)` (Express) agar IP benar di belakang reverse proxy; tanpa ini semua request terlihat dari IP proxy → throttle per-IP bocor.
2. **Validasi ketat** — global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. DTO pakai `@MaxLength`/`@ArrayMaxSize` (§4). `forbidNonWhitelisted` menolak field asing → `status`/`reviewedBy`/`archiveId`/`categoryIds`/`documentIds` **tidak bisa disuntik** dari body; server yang menentukannya. Set **body JSON limit** ketat untuk route publik (mis. **64–100 kb**).
3. **Upload hardening (thumbnail/gambar)** — pertahankan MIME allowlist + size cap (`UPLOAD_MAX_SIZE_MB`), **tambah**: sniff **magic bytes** (bukan cuma header `Content-Type`), **tolak SVG** (XSS), re-encode/downscale via `ImageProcessor` (strip EXIF + normalisasi format), key acak UUID (sudah), `entityType` **di-hardcode server-side** (`'archive-submission'`, jangan dari body).
3b. **Upload hardening (PDF attachment publik = abuse surface).** `POST /archive-submissions/attachments` menerima file anonim, jadi dipertahankan ketat:
   - **PDF-only**: mime `application/pdf` **dan** sniff magic-byte `%PDF-` (`DocumentService` sudah menolak polyglot/executable ber-header palsu) → **422**.
   - **Max 10 MB per file** (`UPLOAD_DOCUMENT_MAX_SIZE_MB`) di `DocumentUploadInterceptor` + `DocumentService` (dua lapis) → **422**.
   - **Cap 20 attachment** per submission (`@ArrayMaxSize(20)` pada `attachments`).
   - **Per-IP throttle ~10/menit** pada endpoint upload.
   - **`entityType` di-hardcode server-side** (`'archive-submission'`); body `entityType` tidak diterima.
   - **Tidak mempercayai filename** — key S3 selalu `documents/<uuid>.pdf` (UUID acak), `originalname` hanya metadata.
   - **Tidak ada listing publik attachment** — hanya admin (`GET /archive-submissions/:id`) yang melihat `attachments`; pemanggil anonim tidak bisa mem-browse upload.
   - **Orphan cleanup TODO**: baris `Document` `entityId=null` milik submission yang di-`REJECT` (atau tak pernah disetujui) tidak terhapus → cleanup worker (`libs/src/commands/`). Lihat archive.md §9 (orphan dokumen).
4. **Thumbnail URL trust** — `POST /archive-submissions` hanya menerima URL milik storage EGS: `imageService.isTrustedUnboundUrl(url, 'archive-submission')` (prefix `S3_PUBLIC_BASE_URL` **DAN** baris `Image` `entityType='archive-submission'` & `entityId=null`). Selain itu → **422** `thumbnail must reference an uploaded EGS image`. Cegah SSRF/hotlink ke domain asing.
5. **CORS** — origin **allowlist dari env** (domain website EGS), bukan `*`; `credentials: false` untuk route publik (tanpa cookie).
6. **Bot mitigation** — honeypot tersembunyi (mis. field `website` harus kosong) → bila terisi, tolak. Rekomendasi captcha (**Cloudflare Turnstile**) sebagai **opsional**: bila diaktifkan, verifikasi token di **controller/service** (bukan DTO), env untuk secret; jangan log token.
7. **Anti-duplikat/abuse** — tolak duplikat identik (`name`) dalam window singkat (mis. **10 menit**) → **409**, mirror `DUPLICATE_WINDOW_MS` event-submission (`$transaction` `Serializable` menutup race insert). Opsional cap per-IP/hari.
8. **Anti stored-XSS** — `description` adalah teks biasa (textarea), bukan rich HTML; tetap escape bila FE merender sebagai HTML. `externalLinks` hanya URL tervalidasi (`@IsUrl`) — cegah `javascript:`/`data:`.
9. **Privasi/GDPR (Eropa)** — simpan data minimum (tidak ada identitas submitter, §9.3). Bila IP disimpan untuk anti-abuse, simpan **hash** (bukan mentah) dan sebut retensi/log. Jangan simpan PII yang tak perlu.
10. **No info leak** — respons `POST` publik hanya `{ id, status }` (§5.1), **jangan** echo row/PII. Error generik, **tanpa stack trace**.
11. **Approve path** — tetap butuh permission `archive-submission:approve`; **membuat `Archive` `DRAFT`** (bukan publish) di dalam transaksi `prisma.$transaction` (§5.2.1); gagal → rollback. Publikasi berikutnya memakai permission `archive:publish` milik modul archive.
12. **Bypass workflow dicegah** — publik tidak punya jalur apa pun untuk menulis ke tabel `archives` atau mengubah status selain lewat approve admin. PDF publik hanya membuat baris `Document` `entityType='archive-submission'`, `entityId=null` (belum ter-bind ke archive); ia tidak bisa mem-bind sendiri ke archive mana pun. `categoryIds` hanya bisa diisi admin via modul archive terautentikasi; PDF yang diupload publik ikut baru saat approve (§5.2.1).

Semua poin di atas **bagian rencana**, belum ada kode. Bila throttler/captcha ditunda, catat sebagai risiko sampai terpasang.

---

## 9. Catatan

### 9.1 Perubahan file existing yang perlu diimplementasikan

| # | File | Perubahan |
| --- | --- | --- |
| 1 | `libs/prisma/schema.prisma` | enum `ArchiveSubmissionStatus`, model `ArchiveSubmission` (+ scalar `attachmentIds String[]`, `archiveId @unique` relasi ke `Archive`), back-relation `Archive.submission`; migration baru `add_archive_submissions`. |
| 2 | `libs/prisma/seed-data.ts` + `libs/prisma/seed.ts` | **3** permission `archive-submission:read/approve/reject` ke `DEFAULT_PERMISSIONS`, ketiganya **admin-only**. Jalankan `pnpm prisma:seed`. |
| 3 | `libs/src/modules/image/dto/upload-image.dto.ts` | `@IsIn([...])` tambah `'archive-submission'` (dipertahankan untuk thumbnail). |
| 4 | `libs/src/libs.module.ts` | daftar `ArchiveSubmissionModule` (imports/exports). |
| 5 | `apps/app/src/app.module.ts` | daftar `ArchiveSubmissionsController`. |
| 6 | `libs/src/modules/archive-submission/archive-submission.module.ts` | impor `ArchiveModule` + `ImageModule` + **`DocumentModule`** (approve memakai `ArchiveService`; thumbnail memakai `ImageService`; attachment upload + hydrate memakai `DocumentService`/`DocumentRepository`). |
| 7 | `libs/src/common/interceptors/document-upload.interceptor.ts` | **reuse tanpa perubahan** — sudah generik (PDF-only, `UPLOAD_DOCUMENT_MAX_SIZE_MB`, field `file`, error → 422). Tidak ada perubahan diperlukan. |
| 8 | env | reuse `UPLOAD_DOCUMENT_MAX_SIZE_MB` (default `10`) untuk attachment publik; **tidak ada env baru**. |
| 9 | `libs/src/modules/archive/archive.service.ts` + `archive.repository.ts` | **(bersyarat, untuk approve atomik §5.2.1)** tambah param opsional `tx?: Prisma.TransactionClient` ke `create`; thread `tx` ke `DocumentRepository.bind`. Tanpa ini approve tidak atomic. |
| 10 | `backend/docs/modules/rbac.md` §7 | update hitungan `DEFAULT_PERMISSIONS` (65 → 68, +3); ketiga code `archive-submission:*` admin-only. |

Perintah: `pnpm prisma migrate dev --name add_archive_submissions` → `pnpm prisma:generate` → `pnpm prisma:seed` → `pnpm tsc --noEmit` → `pnpm lint` (AGENTS.md Verifikasi).

### 9.2 Hubungan dengan workflow archive internal (WAJIB dibaca)

Modul `archive` **sudah** punya workflow internal terautentikasi penuh:

- `archive:submit` (`DRAFT → REQUEST`), `archive:approve` (`REQUEST → PUBLISHED`), `archive:reject` (`REQUEST → DRAFT`), `archive:publish` (`APPROVED → PUBLISHED`), `archive:unpublish` (`PUBLISHED → DRAFT`) — [archive.md §5](./archive.md#5-aturan-status).
- Dipakai oleh role `organization`/`member` yang terautentikasi mengusulkan archive dari dalam EGS.

`archive-submission` publik ini adalah **jalur kedua yang terpisah**:

- **Tabel berbeda** (`archive_submissions` vs `archives`).
- **Pelaku berbeda** (anonim tanpa akun vs user terautentikasi).
- **Permission berbeda** (`archive-submission:*` vs `archive:*`).
- **Kontrol berbeda** (honeypot/captcha/throttle publik vs RBAC + row-level scoping).

**Aturan:** jangan menyatukan kedua tabel, jangan menambahkan transisi status baru ke `ARCHIVE_TRANSITIONS` untuk melayani submission publik, dan jangan mengubah perilaku `archive:submit`/`archive:approve`/`archive:reject` existing. Approve submission publik menghasilkan `Archive` `DRAFT` dan melewati `archive:submit`. Setelah itu konten dikelola lewat endpoint archive existing.

### 9.3 Keputusan desain & simplifikasi sadar

- Tabel terpisah (`archive_submissions`) — submission bukan `Archive` sampai **disetujui**; saat approve dibuat `Archive` `DRAFT` dan ditautkan `archiveId` (§5.2). Submission tetap tersimpan sebagai audit.
- **Tanpa `categoryIds` di submit publik** — input anonim tak termoderasi tidak boleh menentukan kategori; admin menetapkan pada `Archive` `DRAFT` setelah approve lewat `PATCH /archives/:id`.
- **PDF publik DIDUKUNG** lewat `POST /archive-submissions/attachments` + field `attachments` — id baris `Document` (`entityType='archive-submission'`, `entityId=null`) berurut; saat approve disalin ke `Archive.documentIds` dan di-bind (§5.2.1). Bukan lagi ditunda. Mitigasi abuse ada di §8 poin 3b (PDF-only + magic-byte, max 10 MB, cap 20, throttle 10/menit, key UUID, orphan cleanup TODO). **Upgrade path (belum ada):** varian/thumbnail PDF, scan malware (AV), atau kuota per-IP/hari bila volume naik. `documentIds` (nama field archive) tetap tidak diterima dari body publik.
- **Tanpa identitas/contact submitter** (ditunda) — `Archive` tidak punya padanan organiser/organization, dan submission publik tak menyediakan fallback kontak. Audit tetap via `reviewedBy`/`reviewedAt`. **Upgrade path:** tambah kolom `submitterName`/`submitterEmail` opsional pada `archive_submissions` bila tim moderasi butuh menghubungi pengusul.
- `archiveId @unique` + conditional update `status: REQUEST` → idempotensi approve (tidak ada `Archive` dobel). `onDelete: SetNull` → audit tetap walau `Archive` dihapus.
- Status final tidak bisa diubah → 409 (bukan overwrite).
- Endpoint publik tetap `@Public()` tanpa permission; 3 permission `archive-submission:*` tetap di-seed, **admin-only** (§7).
- **Dashboard admin = konsumen list admin, tanpa endpoint baru.** UI memakai `GET /archive-submissions?filter[status]=REQUEST`; count dari `meta.total`.

### 9.4 Keputusan terbuka (perlu konfirmasi saat implementasi)

- **Cara publish `Archive` `DRAFT` hasil approve.** `ARCHIVE_TRANSITIONS.publish` existing ber-`from: APPROVED`, sehingga `DRAFT → PUBLISHED` belum terlayani oleh `POST /archives/:id/publish`. Dua opsi: (a) admin mem-publish via `PATCH /archives/:id` dengan `status: PUBLISHED`/`publishedAt` (scope `all` sudah mengizinkan, tanpa perubahan `ARCHIVE_TRANSITIONS` — **rekomendasi, paling sedikit perubahan**), atau (b) tambah `DRAFT` ke `from` `ARCHIVE_TRANSITIONS.publish` agar `POST /archives/:id/publish` menerima `DRAFT` (memperluas perilaku endpoint existing — perlu persetujuan). Putuskan sebelum implementasi; dokumen ini **tidak** mengubah `ARCHIVE_TRANSITIONS`.
- **`tx` threading ke `ArchiveService.create`** (§5.2.1): perubahan ini secara teknis menyentuh modul archive. Bila ditolak, alternatif approve non-atomik (buat `Archive` dulu, lalu conditional update; kompensasi hapus `Archive` bila update gagal) menerima risiko sementara tanpa rollback sejati — tidak direkomendasikan.
