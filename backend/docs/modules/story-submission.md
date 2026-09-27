# Module: Story Submission

Menu: [story.md](./story.md) (resource tujuan / `Post`) · [archive-submission.md](./archive-submission.md) (pola acuan terdekat) · [event-submission.md](./event-submission.md) (pola acuan) · [rbac.md](./rbac.md) (master)

> **STATUS: DIIMPLEMENTASIKAN (backend).** Migration `20260927100000_add_story_submission_content_fields` dibuat + diterapkan; modul `story-submission` + controller + seed permission tersedia. **Analog terdekat: `archive-submission`** (pola controller/service/repository/duplicate-guard/approve-atomik + reassign attachment diikuti hampir verbatim). Lihat [§9.1](#91-perubahan-file-existing).

---

## 1. Deskripsi & Lokasi

Fitur **Story Submission**: orang di luar EGS (tanpa akun) mengusulkan story lewat form publik. Backend menyimpan usulan di tabel tersendiri `story_submissions`; admin meninjau lewat endpoint admin (approve/reject). **Approve bukan sekadar ubah status**: usulan yang disetujui **di-recreate** menjadi row `Post` `status=DRAFT` (`publishedAt=null`), lalu admin **mengedit + mem-publish** story tersebut lewat alur publish modul story yang sudah ada ([story.md §6](./story.md#6-aturan-status)). Approve **tidak** langsung menayangkan story di website EGS.

> **PENTING — tidak ada konflik dengan workflow story internal.** Modul `story`/`post` **sudah** punya workflow internal terautentikasi (`story:submit` DRAFT → REQUEST → approve/reject/publish/unpublish, [story.md §6](./story.md#6-aturan-status)). `story-submission` adalah **tabel & jalur terpisah** untuk submitter eksternal anonim. Fitur ini **TIDAK** mengubah `POST_TRANSITIONS` dan **tidak** mengubah perilaku `story:submit`/`story:approve`/`story:reject`. Approve submission publik membuat `Post` `DRAFT` dan **melewati** `story:submit` (tidak ada transisi ke `REQUEST`); admin mengedit lalu mem-publish lewat alur story existing.

**Semua submission yang masuk adalah publik anonim** dan muncul di dashboard admin. Dashboard admin tidak memakai endpoint baru: ia mengonsumsi list admin `GET /story-submissions` yang difilter `status` (§5.3).

Karakteristik:

- **Satu jalur: publik anonim** — `POST /story-submissions` (form website EGS, `@Public()`), memakai `CreateStorySubmissionDto`, menghasilkan `status=REQUEST`, dan masuk antrean review admin (approve/reject).
- **Tanpa autentikasi** untuk endpoint publik (`POST /story-submissions`, `POST /story-submissions/thumbnail`, `POST /story-submissions/images`, `GET /story-submissions/categories`).
- **Tabel terpisah** dari `posts` saat submit; approve membuat `Post` `DRAFT` dan menautkannya via `StorySubmission.postId` (§5.2.1). Submission **tidak dihapus** setelah approve — tetap tersimpan sebagai audit (`status=APPROVED`, `postId` terisi).
- Status: `REQUEST` (default) → `APPROVED` / `REJECTED` (final). Hanya `APPROVED` yang membuat `Post` (`DRAFT`); `REJECTED` tidak.
- **Field submission publik**: `name`, `content` (rich HTML, **disanitasi**), `categoryIds`, `galleryImageIds`, `flyerImageIds`, `thumbnail` (opsional). Tanpa identitas/contact submitter.

### Lokasi kode

```
libs/src/modules/story-submission/
├── story-submission.repository.ts
├── story-submission.service.ts
├── story-submission.module.ts      ← impor PostModule + ImageModule + CategoryModule
├── dto/
│   ├── create-story-submission.dto.ts
│   ├── review-story-submission.dto.ts
│   └── list-story-submissions-query.dto.ts
└── entities/
    └── story-submission.entity.ts

libs/src/common/utils/
└── sanitize.util.ts                 ← sanitizeStoryContent() (allowlist ketat)

apps/app/src/controllers/
└── story-submissions.controller.ts   ← controller di apps/, bukan libs (RULES bab 3)
```

Alur baku `Controller → Service → Repository → Prisma`; repository satu-satunya tempat query Prisma (RULES bab 3). Modul didaftarkan di `libs/src/libs.module.ts` (imports + exports) dan controller di `apps/app/src/app.module.ts` — mengikuti modul `archive-submission`.

Perubahan file existing:

| File | Perubahan |
| --- | --- |
| `libs/prisma/schema.prisma` | `StorySubmission.shortDescription` → `content String @db.Text`; tambah `categoryIds`/`galleryImageIds`/`flyerImageIds String[] @default([])`. Migration `20260927100000_add_story_submission_content_fields`. |
| `libs/prisma/seed-data.ts` | (sudah ada dari iterasi sebelumnya) **3** permission `story-submission:*` (`read`/`approve`/`reject`) admin-only. |
| `libs/src/common/utils/sanitize.util.ts` | **File baru**: `sanitizeStoryContent(html)` (`sanitize-html`). |
| `libs/src/modules/image/image.repository.ts` | `findByIds(ids, tx?)` jadi tx-aware + tambah `reassignEntityType(ids, from, to, tx?)`. |
| `libs/src/modules/image/dto/upload-image.dto.ts` | `'story-submission'` sudah ada di `@IsIn` `UploadImageDto`. |
| `libs/src/modules/story-submission/story-submission.module.ts` | impor `CategoryModule`. |
| `libs/src/libs.module.ts` | daftar `StorySubmissionModule` (imports/exports). |
| `libs/src/index.ts` | export module/service/repository/entity/DTO story-submission. |
| `apps/app/src/app.module.ts` | daftar `StorySubmissionModule` + `StorySubmissionsController`. |
| `backend/package.json` | dep `sanitize-html` + devDep `@types/sanitize-html`. |

---

## 2. Model Prisma

`libs/prisma/schema.prisma`:

```prisma
enum StorySubmissionStatus {
  REQUEST
  APPROVED
  REJECTED
}

model StorySubmission {
  id              String                @id @default(uuid())
  name            String
  content         String                @db.Text
  categoryIds     String[]              @default([]) @map("category_ids")
  galleryImageIds String[]              @default([]) @map("gallery_image_ids")
  flyerImageIds   String[]              @default([]) @map("flyer_image_ids")
  thumbnail       String?
  status          StorySubmissionStatus @default(REQUEST)
  adminNote       String?               @map("admin_note")
  reviewedBy      String?               @map("reviewed_by")
  reviewedAt      DateTime?             @map("reviewed_at")
  postId          String?               @unique @map("post_id")
  post            Post?                 @relation(fields: [postId], references: [id], onDelete: SetNull)
  createdAt       DateTime              @default(now()) @map("created_at")
  updatedAt       DateTime              @updatedAt @map("updated_at")

  @@index([status])
  @@map("story_submissions")
}
```

**Back-relation yang wajib** (tanpa ini `prisma validate` gagal):

```prisma
model Post {  // tambah baris
  submission StorySubmission?
}
```

Catatan:

- `postId @unique` + `post` relasi opsional (`onDelete: SetNull`) → satu submission hanya boleh menunjuk satu `Post`; approve ganda tidak bisa membuat `Post` dobel (idempotensi, §5.2.1). `SetNull` → hapus `Post` tidak menghapus submission (jejak audit tetap).
- `content` = **rich HTML yang sudah disanitasi** (allowlist ketat, §8 poin 8). Di-sanitasi lagi saat approve (defense in depth).
- `categoryIds`/`galleryImageIds`/`flyerImageIds` = `String[]` scalar (bukan relasi Prisma) — urutan array = urutan tampil.
- `reviewedBy` **scalar tanpa relasi** ke `User` (disengaja; kolom audit saja).
- Migration `20260927100000_add_story_submission_content_fields`: drop `short_description`, add `content` (+ backfill dari `short_description` untuk row existing) + 3 kolom array.

---

## 3. Entity Payload

Ikuti RULES bab 4 (satu `select` + `Prisma.GetPayload`). Relasi `post` hanya butuh rujukan minimal (`{ id, slug, status }`).

```typescript
// libs/src/modules/story-submission/entities/story-submission.entity.ts
export const storySubmissionSelect = {
  id: true, name: true, content: true,
  categoryIds: true, galleryImageIds: true, flyerImageIds: true,
  thumbnail: true, status: true, adminNote: true, reviewedBy: true, reviewedAt: true,
  postId: true, createdAt: true, updatedAt: true,
  post: { select: { id: true, slug: true, status: true } },
} satisfies Prisma.StorySubmissionSelect;

export type StorySubmissionEntity = Omit<StorySubmissionPayload, 'post'> & {
  post: { id: string; slug: string; status: string } | null;
};

// Item LIST: buang content/id mentah, ekspos nama kategori + jumlah gambar.
export type StorySubmissionListItem = Omit<
  StorySubmissionEntity, 'content' | 'categoryIds' | 'galleryImageIds' | 'flyerImageIds'
> & { categories: { id: string; name: string }[]; galleryCount: number; flyerCount: number };

// DETAIL: item list + content + categoryIds mentah + galeri/flyer ter-resolve berurut.
export type StorySubmissionDetail = StorySubmissionListItem & {
  content: string;
  categoryIds: string[];
  gallery: ImageResponse[];
  flyer: ImageResponse[];
};
```

- `mapStorySubmission()` flatten join `post` → `{ id, slug, status }` (null bila belum ditautkan).
- List & detail memakai select yang sama. Id mentah (`categoryIds`/`galleryImageIds`/`flyerImageIds`) tidak bocor di item list; resolusi nama kategori dilakukan sekali secara batch (§5.3).
- Detail memakai `ImageRepository.findByIds()` + `ImageService.toImageResponse()` untuk `gallery`/`flyer`.

---

## 4. DTO

### `CreateStorySubmissionDto`

File: `libs/src/modules/story-submission/dto/create-story-submission.dto.ts`.

| Field | Aturan |
| --- | --- |
| `name` | `@Transform(trim)`, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `content` | `@IsString()`, `@IsNotEmpty()`, `@MaxLength(100000)` — rich HTML, disanitasi server-side |
| `categoryIds` | opsional `@IsArray()`, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(20)` — tiap id wajib `Category` `type='STORY'` (422 `categoryIds.N`) |
| `galleryImageIds` | opsional `@IsArray()`, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(50)` — id dari `POST /story-submissions/images` |
| `flyerImageIds` | opsional `@IsArray()`, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(50)` |
| `thumbnail` | opsional `@IsString()`, `@MaxLength(2048)` — URL storage EGS |

`forbidNonWhitelisted` (§8 poin 2) **menolak** body yang menyertakan `status`/`reviewedBy`/`postId` dengan **422**; klien tidak dapat menyuntik field server-derived. `shortDescription` **dihapus** dari kontrak (tidak lagi diterima).

### Contoh payload request

```json
{
  "name": "Sejarah Gamelan di Eropa",
  "content": "<p>Catatan perjalanan gamelan dari Yogyakarta ke Amsterdam.</p>",
  "categoryIds": ["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
  "galleryImageIds": ["b7e2c1a0-1111-4222-8333-000000000001"],
  "flyerImageIds": ["b7e2c1a0-1111-4222-8333-000000000002"],
  "thumbnail": "https://cdn.example.com/posts/original/abc.jpg"
}
```

### Contoh 422 (validasi per-field)

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    { "field": "categoryIds.0", "message": "category not found or not a STORY category" },
    { "field": "galleryImageIds.1", "message": "image not found, wrong type, or already bound" }
  ]
}
```

### `ReviewStorySubmissionDto`

File: `libs/src/modules/story-submission/dto/review-story-submission.dto.ts`. Mirror `ReviewArchiveSubmissionDto`.

```typescript
export class ReviewStorySubmissionDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
```

### `ListStorySubmissionsQueryDto`

File: `libs/src/modules/story-submission/dto/list-story-submissions-query.dto.ts`. Kosong, mewarisi `ListQueryDto` (whitelist filter/sort di service, §5.3).

```typescript
export class ListStorySubmissionsQueryDto extends ListQueryDto {}
```

---

## 5. Endpoint

Semua path prefix **`/api/v1`** (RULES bab 1). Sukses `{ data, message }`; list `{ data, meta, message }`; error `{ statusCode, message, errors }` (RULES bab 5).

### 5.1 PUBLIK (`@Public()`, tanpa RBAC)

**`@Public()` = bypass penuh deny-by-default.** Guard `JwtAuthGuard` dan `PermissionsGuard` (rbac.md §6) melewatkan endpoint `@Public()` tanpa JWT **dan** tanpa cek metadata `@Permissions`.

| Method | Path | Deskripsi | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/story-submissions` | Buat usulan story, `status=REQUEST` | `CreateStorySubmissionDto` (JSON) | 201 `{ data: { id, status }, message }` |
| POST | `/api/v1/story-submissions/thumbnail` | Upload thumbnail usulan | multipart `file` | 201 `{ data: ImageResponse, message }` |
| POST | `/api/v1/story-submissions/images` | Upload galeri/flyer usulan | multipart `file` | 201 `{ data: ImageResponse, message }` |
| GET | `/api/v1/story-submissions/categories` | Kategori `STORY` untuk form publik | — | 200 `{ data: [{ id, name }], meta, message }` |

- `POST /story-submissions` → service `create()` men-set `status=REQUEST`, lalu balikan **hanya** `{ id, status }` (bukan seluruh row/PII echo, §8 poin 11). Throttle **5/menit**. 422 validasi per-field.
- `POST /story-submissions/thumbnail` & `POST /story-submissions/images` → panggil `ImageService.upload(file, 'story-submission')`; **hardcode** `entityType` di controller, **jangan** terima dari body publik. Throttle **10/menit** masing-masing. Balikan `ImageResponse`.
- `GET /story-submissions/categories` → `CategoryRepository.findMany({ where: { type: 'STORY' }, take: 100, orderBy: { name: 'asc' } })`; service (`listCategories()`) memetakan ke `{ id, name }`. `meta = { page: 1, limit: 100, total }`. **Declare sebelum `@Get(':id')`**.

Contoh respons 201 (**hanya** `{ id, status }`):

```json
{
  "data": { "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "status": "REQUEST" },
  "message": "success"
}
```

### 5.2 ADMIN (auth + permission)

| Method | Path | Permission | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/story-submissions` | `story-submission:read` | `ListStorySubmissionsQueryDto` | 200 `{ data, meta, message }` |
| GET | `/api/v1/story-submissions/:id` | `story-submission:read` | `id` UUID (`ParseUUIDPipe`) | 200 `{ data, message }` |
| POST | `/api/v1/story-submissions/:id/approve` | `story-submission:approve` | body opsional `{ adminNote? }` | 200 `{ data: { submission, story: { id, slug, status: 'DRAFT' } }, message }` |
| POST | `/api/v1/story-submissions/:id/reject` | `story-submission:reject` | body `{ adminNote? }` | 200 `{ data, message }` |

- `GET /story-submissions` — list paginasi + search + sort (kontrak §5.3). **Dashboard admin memakai endpoint ini**: `GET /story-submissions?filter[status]=REQUEST`; jumlah cukup dibaca dari `meta.total` per filter.
- `GET /story-submissions/:id` — detail penuh (termasuk `content` + `gallery`/`flyer`); tidak ada → 404 `NotFoundException('Story submission not found')`.
- `POST .../approve` — **membuat `Post` `status=DRAFT`** dalam satu transaksi (alur lengkap §5.2.1). Response menyertakan `story.id` + `story.slug`.
- `POST .../reject` — set `status=REJECTED`, `reviewedBy=user.id`, `reviewedAt=now`. **Tidak** membuat `Post`.
- Perubahan status pada row yang **sudah final** → **409** `ConflictException` (`Cannot <action> story submission in status <STATUS>`). Conditional update (`updateMany` dengan `where: { id, status: REQUEST }`) menutup race.

#### 5.2.1 `POST /:id/approve` — alur transaksional (approve → insert `posts` sebagai `DRAFT`)

**Wajib** dibungkus `prisma.$transaction`. Urutan (mirror `archive-submission` approve):

1. **Conditional update** `storySubmission.updateMany({ where: { id, status: 'REQUEST' }, data: { status: 'APPROVED', reviewedBy, reviewedAt: now, adminNote? } })`. `count === 0` → **404** (row tidak ada) atau **409** (sudah final) — dibedakan dengan `findUnique`.
2. **Fetch submission** (ambil `content`, `categoryIds`, `galleryImageIds`, `flyerImageIds`, `thumbnail`, `name`).
3. **Reassign gambar**: `imageRepository.reassignEntityType([...galleryImageIds, ...flyerImageIds], 'story-submission', 'post', tx)` — pindah `entityType` (entityId tetap null) agar `PostRepository.bindImages()` berikutnya mem-bind row ke post baru.
4. **Generate slug unik tx-aware**: `slugify(name)`, loop suffix `-2`, `-3`, … selama `postRepository.existsBySlug(slug, tx)`.
5. **Buat `Post`**: `postRepository.createInTransaction(tx, { name, slug, content: sanitizeStoryContent(submission.content), thumbnail, status: DRAFT, visibility: PUBLIC, createdBy: reviewerUserId, categoryIds, galleryImageIds, flyerImageIds })`. `createInTransaction` **memakai `tx` pemanggil**.
6. **Tautkan submission**: `postId = story.id`.
7. **Respons**: `{ data: { submission (list-item shape), story: { id, slug, status: 'DRAFT' } }, message }`.
8. **Gagal di tengah → rollback**; submission tetap `REQUEST`, tidak ada `Post` yatim. Retry maks 5× bila `P2002` (slug kalah race) → lalu **409**.

> `ponytail:` satu transaksi DB cukup sebagai penjaga race + atomisitas; `postId @unique` + conditional update `status: REQUEST` menjamin idempotensi. Jangan bangun saga/outbox.

**Tabel mapping field (submission → `Post`)**

| Submission | Post | Catatan |
| --- | --- | --- |
| `name` | `name` | langsung. |
| (auto) | `slug` | `slugify(name)` + sufiks unik; bentrok → `-2`, `-3`, dst. |
| `content` | `content` | **disanitasi ulang** `sanitizeStoryContent()` (defense in depth). |
| `categoryIds` | `categoryIds` | relasi `post_categories` (semua id sudah divalidasi STORY saat create). |
| `galleryImageIds` | `galleryImageIds` + bind | gambar di-reassign ke `entityType='post'` lalu di-bind ke post. |
| `flyerImageIds` | `flyerImageIds` + bind | idem. |
| `thumbnail` | `thumbnail` | URL storage EGS (opsional). |
| `status` (`APPROVED`) | `status` | `DRAFT` + `publishedAt=null`. Publish dilakukan admin via alur story existing. |
| `reviewedBy` | `createdBy` | admin penyetuju (submission tak punya `User`). |
| — | `visibility` | `PUBLIC` (konstanta). |

> **Publikasi setelah approve.** `Post` hasil approve berstatus `DRAFT`; **publikasi bukan bagian dari approve**. Admin mengeditnya lewat modul story existing (`PATCH /posts/:id`, `story:update`) lalu mem-publish. `POST_TRANSITIONS` **tidak diubah** (§9.4).

**Respons approve**:

```json
{
  "data": {
    "submission": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Sejarah Gamelan di Eropa",
      "thumbnail": null,
      "status": "APPROVED",
      "adminNote": "Sumber terverifikasi.",
      "reviewedBy": "d290f1ee-...",
      "reviewedAt": "2026-09-27T08:00:00.000Z",
      "postId": "b7e2c1a0-...",
      "post": { "id": "b7e2c1a0-...", "slug": "sejarah-gamelan-di-eropa", "status": "DRAFT" },
      "categories": [{ "id": "36b5c189-...", "name": "gamelan" }],
      "galleryCount": 2,
      "flyerCount": 1
    },
    "story": { "id": "b7e2c1a0-...", "slug": "sejarah-gamelan-di-eropa", "status": "DRAFT" }
  },
  "message": "success"
}
```

### 5.3 Kontrak List Admin (RULES bab 19/19a/19b)

Konstanta di-export dari `story-submission.service.ts`:

| Konstanta | Nilai |
| --- | --- |
| `STORY_SUBMISSION_SEARCHABLE_FIELDS` | `['name']` |
| `STORY_SUBMISSION_SORT_FIELDS` | `['name', 'status', 'createdAt', 'updatedAt']` |
| `STORY_SUBMISSION_FILTER_FIELDS` | `['status', 'createdAt', 'updatedAt', 'reviewedAt']` |
| `STORY_SUBMISSION_DATE_FIELDS` | `['reviewedAt', 'createdAt', 'updatedAt']` |

Item list **tidak** membocorkan `content`/id gambar/kategori mentah. Nama kategori di-resolve **satu kali secara batch** (`categoryRepository.findByIds` atas union `categoryIds` semua item) — hindari N+1.

Bentuk item list: `{ id, name, thumbnail, categories: {id,name}[], galleryCount, flyerCount, status, adminNote, reviewedBy, reviewedAt, postId, post: {id,slug,status}|null, createdAt, updatedAt }`.

Bentuk detail (`GET /:id`) = item list + `content`, `categoryIds`, `gallery: ImageResponse[]` (berurut), `flyer: ImageResponse[]` (berurut).

Contoh query & respons list:

```
GET /api/v1/story-submissions?page=1&limit=20&sortBy=createdAt&sortOrder=desc&filter[status]=REQUEST&search=gamelan
```

```json
{
  "data": [
    {
      "id": "3fa85f64-...",
      "name": "Sejarah Gamelan di Eropa",
      "thumbnail": null,
      "status": "REQUEST",
      "adminNote": null,
      "reviewedBy": null,
      "reviewedAt": null,
      "postId": null,
      "post": null,
      "categories": [{ "id": "36b5c189-...", "name": "gamelan" }],
      "galleryCount": 2,
      "flyerCount": 1,
      "createdAt": "2026-09-27T10:00:00.000Z",
      "updatedAt": "2026-09-27T10:00:00.000Z"
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
| `POST /story-submissions` | `UnprocessableEntityException` | 422 | validasi DTO per-field; `categoryIds.N` bukan kategori STORY; `galleryImageIds.N`/`flyerImageIds.N` bukan image submission tak terikat; `thumbnail` bukan milik storage EGS |
| `POST /story-submissions` | `ConflictException` | 409 | duplikat identik (`name`) dalam window singkat |
| `POST /story-submissions/thumbnail`, `/images` | `UnprocessableEntityException` | 422 | file hilang / MIME tak didukung / terlalu besar (dari `ImageService`) |
| `GET /story-submissions` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, enum/tanggal invalid |
| `GET /story-submissions/:id` | `BadRequestException` | 400 | `:id` bukan UUID (`ParseUUIDPipe`) |
| `GET /story-submissions/:id` | `NotFoundException` | 404 | submission tidak ada |
| `POST /:id/approve`, `/:id/reject` | `ConflictException` | 409 | row sudah final (`APPROVED`/`REJECTED`) — `Cannot <action> story submission in status <STATUS>` |
| `POST /:id/approve`, `/:id/reject` | `NotFoundException` | 404 | submission tidak ada |
| `POST /:id/approve` | `InternalServerErrorException` | 500 | gagal saat transaksi insert `Post` `DRAFT` → rollback, submission tetap `REQUEST` |
| admin endpoints | `UnauthorizedException` / `ForbiddenException` | 401 / 403 | JWT invalid / permission kurang |
| `POST /story-submissions*` | `HttpException` (429) | 429 | rate limit terlampaui |

---

## 7. Permission

Seed di `libs/prisma/seed-data.ts` (`DEFAULT_PERMISSIONS`). Konvensi `resource:action` lowercase (rbac.md §4).

| Code | Deskripsi | admin | organization | member |
| --- | --- | :---: | :---: | :---: |
| `story-submission:read` | Lihat daftar/detail usulan story | ✅ | — | — |
| `story-submission:approve` | Setujui + recreate konten ke tabel `posts` sebagai `DRAFT` (bukan publish) | ✅ | — | — |
| `story-submission:reject` | Tolak usulan | ✅ | — | — |

- Semua **admin-only**; `libs/prisma/seed.ts` **tidak diubah**.
- Endpoint publik (`POST /story-submissions`, `/thumbnail`, `/images`, `GET /categories`) tetap `@Public()` → **tidak butuh** permission apa pun. Submit publik murni anonim.

---

## 8. Keamanan & Anti-Spam

Endpoint tulis publik tanpa auth = permukaan serangan terbuka. Pertahanan terpasang:

1. **Rate limit** — `POST /story-submissions` **5/menit**; `POST /story-submissions/thumbnail` & `/images` **10/menit**, per-IP, `@UseGuards(ThrottlerGuard)` + `@Throttle`. `ThrottlerModule` global di `apps/app/src/app.module.ts`. **Catatan:** `app.set('trust proxy', 1)` (Express) diperlukan agar IP benar di belakang reverse proxy.
2. **Validasi ketat** — global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. DTO pakai `@MaxLength`/`@ArrayMaxSize`/`@IsUUID`. `forbidNonWhitelisted` menolak field asing → `status`/`reviewedBy`/`postId` **tidak bisa disuntik**.
   - **Limit body JSON dinaikkan ke `1mb`** — `app.useBodyParser('json', { limit: '1mb' })` di `apps/app/src/main.ts`. Parser ini didaftarkan sebelum parser JSON default Nest, sehingga `content` `@MaxLength(100000)` (bisa >200KB pada encoding multibyte) **tercapai validasi (422)**; tanpa ini Express default (~100kb) membalas **413** lebih dulu. Hanya JSON — multipart (`/thumbnail`, `/images`) & `urlencoded` tak terpengaruh; >1mb tetap **413**.
3. **Upload hardening (thumbnail & galeri/flyer)** — MIME allowlist + size cap (`UPLOAD_MAX_SIZE_MB`) + sniff magic bytes + tolak SVG + re-encode/downscale via `ImageProcessor`, key acak UUID, `entityType` **di-hardcode server-side** (`'story-submission'`).
4. **Thumbnail URL trust** — `POST /story-submissions` hanya menerima URL milik storage EGS: `imageService.isTrustedUnboundUrl(url, 'story-submission')`. Selain itu → **422**.
5. **Galeri/flyer ownership** — tiap id wajib ada sebagai row `Image` `entityType='story-submission'` & `entityId=null`; selain itu → **422** (`galleryImageIds.N`/`flyerImageIds.N`). Mencegah IDOR/bajak gambar entity lain.
6. **Kategori ownership** — tiap `categoryIds.N` wajib `Category` `type='STORY'`; selain itu → **422**.
7. **CORS** — origin allowlist dari env (domain website EGS), bukan `*`.
8. **Anti stored-XSS** — `content` (rich HTML anonim) **disanitasi** dengan allowlist ketat via `sanitizeStoryContent()`:
   - **Tags diizinkan**: `p,br,strong,em,u,s,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,a,img,code,pre,hr,span`.
   - **Atribut**: `a[href,target,rel]`, `img[src,alt,width,height]`; semua atribut lain (termasuk `on*`, `style`) dibuang.
   - **Scheme**: hanya `http`/`https` (blok `javascript:`, `data:`, dst.).
   - Tag berbahaya (`script`, `iframe`, `object`, `embed`, `form`, `input`, …) dibuang.
   - Link `a` dipaksa `rel="noopener noreferrer"`.
   - Disanitasi **saat create DAN saat approve** (defense in depth; row tersimpan tidak pernah dipercaya).
9. **Bot mitigation** — rekomendasi captcha (**Cloudflare Turnstile**) opsional; verifikasi di controller/service, jangan log token.
10. **Anti-duplikat/abuse** — tolak duplikat identik (`name`) dalam window **10 menit** → **409** (`DUPLICATE_WINDOW_MS`, `$transaction` `Serializable` menutup race insert).
11. **Privasi/GDPR** — data minimum (tanpa identitas submitter). Bila IP disimpan untuk anti-abuse, simpan **hash** dan sebut retensi.
12. **No info leak** — respons `POST` publik hanya `{ id, status }`; error generik tanpa stack trace.
13. **Bypass workflow dicegah** — publik tidak punya jalur menulis ke `posts` atau mengubah status selain lewat approve admin. `categoryIds`/rich content/gambar hanya masuk via create publik (divalidasi + disanitasi) lalu approve.

---

## 9. Catatan

### 9.1 Perubahan file existing yang diimplementasikan

| # | File | Perubahan |
| --- | --- | --- |
| 1 | `libs/prisma/schema.prisma` | `StorySubmission.shortDescription` → `content String @db.Text`; tambah `categoryIds`/`galleryImageIds`/`flyerImageIds String[] @default([])`; migration `add_story_submission_content_fields`. |
| 2 | `libs/prisma/seed-data.ts` | 3 permission `story-submission:read/approve/reject` (admin-only). |
| 3 | `libs/src/common/utils/sanitize.util.ts` | File baru `sanitizeStoryContent()`. |
| 4 | `libs/src/modules/image/image.repository.ts` | `findByIds(ids, tx?)` tx-aware + `reassignEntityType(ids, from, to, tx?)`. |
| 5 | `libs/src/modules/image/dto/upload-image.dto.ts` | `'story-submission'` ada di `@IsIn`. |
| 6 | `libs/src/modules/story-submission/story-submission.module.ts` | impor `CategoryModule`. |
| 7 | `libs/src/libs.module.ts` / `libs/src/index.ts` | daftar/export `StorySubmissionModule`. |
| 8 | `apps/app/src/app.module.ts` | daftar `StorySubmissionModule` + `StorySubmissionsController`. |
| 9 | `backend/package.json` | `sanitize-html` + `@types/sanitize-html`. |

Perintah: `pnpm prisma migrate dev --name add_story_submission_content_fields` (DB up) → `pnpm prisma:generate` → `pnpm tsc --noEmit` (AGENTS.md Verifikasi).

### 9.2 Hubungan dengan workflow story internal (WAJIB dibaca)

Modul `story`/`post` **sudah** punya workflow internal terautentikasi penuh, dipakai role `organization`/`member`. `story-submission` publik ini adalah **jalur kedua yang terpisah**:

- **Tabel berbeda** (`story_submissions` vs `posts`).
- **Pelaku berbeda** (anonim tanpa akun vs user terautentikasi).
- **Permission berbeda** (`story-submission:*` vs `story:*`).
- **Kontrol berbeda** (throttle publik vs RBAC + row-level scoping).

**Aturan:** jangan menyatukan kedua tabel, jangan menambahkan transisi status baru ke `POST_TRANSITIONS` untuk melayani submission publik, dan jangan mengubah perilaku `story:submit`/`story:approve`/`story:reject` existing. Approve submission publik menghasilkan `Post` `DRAFT` dan melewati `story:submit`.

### 9.3 Keputusan desain & simplifikasi sadar

- Tabel terpisah (`story_submissions`) — submission bukan `Post` sampai **disetujui**; saat approve dibuat `Post` `DRAFT` + `postId`. Submission tetap sebagai audit.
- **Field publik**: `name`, `content`, `categoryIds`, `galleryImageIds`, `flyerImageIds`, `thumbnail`. `content` wajib disanitasi; kategori divalidasi STORY; gambar divalidasi ownership.
- **Galeri/flyer = images only** (bukan attachment/Document). `entityType` di-hardcode `'story-submission'`.
- **Tanpa identitas/contact submitter** — audit via `reviewedBy`/`reviewedAt`. Upgrade path: kolom `submitterName`/`submitterEmail` opsional.
- `postId @unique` + conditional update `status: REQUEST` → idempotensi approve. `onDelete: SetNull` → audit tetap.
- **Dashboard admin = konsumen list admin, tanpa endpoint baru** (`meta.total`).
- **Thumbnail tidak di-bind ke `Post`.** URL disalin ke `Post.thumbnail` saat approve; baris `Image` thumbnail tetap orphan. Upgrade path: bind/unbind + orphan cleanup worker.
- **Galeri/flyer di-reassign** (`story-submission` → `post`) lalu di-bind oleh `PostRepository.createInTransaction` — mirror pattern `archive-submission` attachment.

### 9.4 Keputusan terbuka (perlu konfirmasi bila relevan)

- **Cara publish `Post` `DRAFT` hasil approve.** `POST_TRANSITIONS.publish` ber-`from: APPROVED`, sehingga `DRAFT → PUBLISHED` belum terlayani `POST /posts/:id/publish`. Opsi: (a) publish via `PATCH /posts/:id` (`status: PUBLISHED`/`publishedAt`, scope `all` — **rekomendasi, paling sedikit perubahan**), atau (b) tambah `DRAFT` ke `from` `POST_TRANSITIONS.publish`. Fitur ini **tidak** mengubah `POST_TRANSITIONS`.
- **Orphan cleanup** baris `Image` milik submission `REJECTED`/tak pernah disetujui → worker (`libs/src/commands/`).
