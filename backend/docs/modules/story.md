# Module: Story

Menu: [rbac.md](./rbac.md) (master) · [user.md](./user.md)

> **STATUS: DIIMPLEMENTASIKAN (backend).** Migration `add_posts_categories` (tweak `Image`) dibuat + diterapkan; module `post` / `category` / `image` + `StorageService`/`ImageProcessor` + controllers + seed permission tersedia. Lihat [§13](#13-status--catatan).

---

## 1. Deskripsi & Lokasi

Modul **`story`** mengelola konten `Post` (nama resource backend: **`post`**, label menu frontend: **Story**). Story hanya berupa teks rich HTML + thumbnail; media inline disisipkan sebagai URL gambar di dalam `content`. Gambar diupload ke **Amazon S3** dan metadatanya dicatat di tabel **`Image`** (`images`) (lihat [§9](#9-upload-gambar-s3--tabel-images)).

Story dimiliki oleh max satu creator (`Post.createdBy → User.id`, nullable) dan berisi banyak kategori (`Category`) melalui join `PostCategory` (N : M).

Lokasi kode (rencana):

```
libs/src/modules/post/
├── post.repository.ts
├── post.service.ts
├── post.module.ts
├── dto/
│   ├── create-post.dto.ts
│   ├── update-post.dto.ts
│   └── list-posts-query.dto.ts
├── entities/
│   └── post.entity.ts
└── utils/
    └── slug.util.ts

libs/src/modules/category/
├── category.repository.ts
├── category.service.ts
├── category.module.ts
├── dto/
│   ├── create-category.dto.ts
│   ├── update-category.dto.ts
│   └── list-categories-query.dto.ts
└── entities/
    └── category.entity.ts

libs/src/modules/image/
├── image.repository.ts
├── image.service.ts
├── image.module.ts
├── dto/
│   └── upload-image.dto.ts
└── entities/
    └── image.entity.ts

libs/src/integrations/storage/
└── storage.service.ts     ← klien S3 (RULES bab 2: klien eksternal → integrations/)

apps/app/src/controllers/
├── posts.controller.ts
├── categories.controller.ts
└── images.controller.ts   ← upload gambar S3 (bukan di libs, RULES bab 3)
```

- Modul bisnis & service di `libs/src/modules/` (RULES bab 3).
- Controller di `apps/app/src/controllers/` — controller tipis, delegasi ke service.
- Alur baku: `Controller → Service → Repository → Prisma`. Repository satu-satunya tempat query Prisma.

### Keputusan desain

| Skenario | Jalur | Akses |
| --- | --- | --- |
| CRUD story admin | `/api/v1/posts*` | PERMISSION `story:*` |
| CRUD kategori | `/api/v1/categories*` | PERMISSION `category:*` |
| Upload gambar editor/thumbnail | `POST /api/v1/images` | PERMISSION `story:create` **atau** `story:update` (ANY-of) |
| Tampilkan gambar (`<img src>`) | URL S3/CDN (bucket public-read) | **PUBLIC** (dilayani S3/CDN, bukan API) |

---

## 2. Model Prisma

Disalin dari `libs/prisma/schema.prisma` apa adanya:

```prisma
enum ContentStatus {
  DRAFT
  REQUEST
  APPROVED
  PUBLISHED
}

enum CategoryType {
  STORY
  ARCHIVE
}

model Post {
  id              String         @id @default(uuid())
  name            String
  slug            String         @unique
  status          ContentStatus  @default(DRAFT)
  publishedAt     DateTime?      @map("published_at")
  approvedAt      DateTime?      @map("approved_at")
  content         String
  thumbnail       String?
  galleryImageIds String[]       @default([]) @map("gallery_image_ids")
  createdBy       String?        @map("created_by")
  creator         User?          @relation("PostCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  categories      PostCategory[]
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  @@index([createdBy])
  @@map("posts")
}

model Category {
  id        String         @id @default(uuid())
  name      String
  type      CategoryType
  posts     PostCategory[]
  createdAt DateTime       @default(now()) @map("created_at")
  updatedAt DateTime       @updatedAt @map("updated_at")

  @@map("categories")
}

model PostCategory {
  id         String   @id @default(uuid())
  postId     String   @map("post_id")
  post       Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  categoryId String   @map("category_id")
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@unique([postId, categoryId])
  @@index([postId])
  @@index([categoryId])
  @@map("post_categories")
}
```

Catatan:

- `Post.name` = judul story (dipakai rich text editor sebagai judul).
- `Post.slug` unik (constraint DB) → `P2002` dipetakan ke `ConflictException` (RULES bab 6). Aturan generate/bentrok lihat [§5](#5-aturan-slug).
- `Post.content` menyimpan **HTML rich text** (hasil editor WYSIWYG, sudah disanitasi di FE).
- `Post.thumbnail` menyimpan **URL gambar absolut S3** (mis. `https://cdn.example.com/posts/<uuid>.webp`). FE tetap mengirim id `Image` terkait lewat `imageIds` agar baris `images` ter-bind ke post ([§4](#4-dto)).
- `Post.galleryImageIds` = daftar id `Image` **berurut** (array Postgres `TEXT[]`, default `[]`). Urutan array = urutan galeri. Diganti **seluruhnya** bila `galleryImageIds` dikirim saat update. Response detail/list tidak mengembalikan field ini mentah — di-resolve jadi `gallery: ImageResponse[]` berurut ([§3](#3-entity-payload-type), [§9](#9-upload-gambar-s3--tabel-images)).
- `PostCategory` = relasi N : M ke `Category`; `@@unique([postId, categoryId])` mencegah duplikat link.
- `Category.type` ∈ `STORY | ARCHIVE`. Halaman story memfilter `type=STORY`.
- `createdBy` nullable + `onDelete: SetNull`; user dihapus → story tetap ada, `creator` null.

### Perubahan schema `Image` (ikut migration `add_posts_categories`)

Upload kini memakai tabel `Image` (`images`), yang sudah ada di schema tetapi belum ada migration-nya. Tweak yang diperlukan pada model `Image` (belum ada migration, jadi **tidak perlu migration terpisah** — ikut `add_posts_categories`):

- `entityId String?` → **nullable**. Alasan: gambar inline/thumbnail diupload **sebelum** `Post` ada (create post belum punya `id` saat editor mengunggah; draft bisa dibatalkan). Binding ke post baru terjadi saat `POST /posts` / `PATCH /posts/:id` disimpan ([§9](#9-upload-gambar-s3--tabel-images)). Tanpa nullable, `image.create` saat upload akan gagal karena belum ada `entityId`.
- `order Int @default(0)` → sebelumnya wajib tanpa default; upload selalu `order=0`, urutan galeri ditentukan FE.
- `key String @unique` (key objek S3, unik per bucket).
- `variants Json?` → array varian turunan (hasil resize/kompresi) per gambar. Metadata top-level (`key, filename, mimeType, size, width, height`) menunjuk **original utuh** (tanpa re-encode); `variants` menyimpan varian teroptimasi untuk delivery. Bentuk elemen: `{ name, key, width, height, size, mimeType }` ([§9](#9-upload-gambar-s3--tabel-images)). Tidak ada migration terpisah — ikut `add_posts_categories`.

Bentuk final `Image` yang diharapkan:

```prisma
model Image {
  id         String   @id @default(uuid())
  entityType String   @map("entity_type")
  entityId   String?  @map("entity_id")
  key        String   @unique
  filename   String
  mimeType   String?  @map("mime_type")
  size       Int?
  width      Int?
  height     Int?
  variants   Json?
  order      Int      @default(0) @map("order")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@index([entityType, entityId])
  @@map("images")
}
```

Catatan: `url` **tidak** ada di `Image` (tidak disimpan di DB) — dihitung saat mapping ([§3](#3-entity-payload-type)). `width`/`height` = dimensi **original** (diisi `sharp` saat pipeline resize, [§9](#9-upload-gambar-s3--tabel-images)). Top-level = original utuh; `variants` = turunan ([§9](#9-upload-gambar-s3--tabel-images)).

### Kebutuhan migration

Tabel `Post`, `Category`, `PostCategory`, `Image` sudah ada dari migration init repo + `add_posts_categories` (tweak `Image`). Kolom `galleryImageIds` ditambahkan lewat migration terpisah (lihat juga [§9](#9-upload-gambar-s3--tabel-images)):

```bash
# sudah dibuat: libs/prisma/migrations/20260920120000_add_post_gallery_image_ids/migration.sql
# ALTER TABLE "posts" ADD COLUMN "gallery_image_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
pnpm prisma:generate
```

---

## 3. Entity Payload Type

Pola `select` + `Prisma.GetPayload` (RULES bab 4). Satu payload type per model, definisi di `entities/`.

```typescript
// libs/src/modules/post/entities/post.entity.ts
import { CategoryType, Prisma } from '@prisma/client';
import type { ImageResponse } from '@app/libs/modules/image/image.service';

// `postSelect` query raw (join shape). JANGAN dikembalikan langsung ke API.
export const postSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  publishedAt: true,
  approvedAt: true,
  content: true,
  thumbnail: true,
  galleryImageIds: true,
  createdBy: true,
  creator: { select: { id: true, fullName: true } },
  categories: {
    select: {
      category: { select: { id: true, name: true, type: true } },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PostSelect;

export type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

export type PostCategoryEntity = { id: string; name: string; type: CategoryType };

// Kontrak response API: `categories` flat (bukan `[{ category }]`).
export type PostEntity = Omit<PostRow, 'categories'> & { categories: PostCategoryEntity[] };

// Kontrak response ke FE: `galleryImageIds` (raw) diganti `gallery` hasil resolusi berurut.
export type PostResponse = Omit<PostEntity, 'galleryImageIds'> & { gallery: ImageResponse[] };

export function mapPost(row: PostRow): PostEntity {
  return { ...row, categories: row.categories.map((link) => link.category) };
}
```

> **Flatten `categories`.** Repository selalu mengembalikan `PostEntity` (flat): `row.categories.map(c => c.category)` via `mapPost()`. Join shape `[{ category }]` tidak boleh bocor ke service/controller. Diterapkan konsisten di `findAll`, `findById`, `create`, `update`, `delete`.

> **Resolve `gallery`.** `PostService.hydrate()` mengubah `PostEntity.galleryImageIds` → `PostResponse.gallery: ImageResponse[]` lewat `ImageRepository.findByIds` + `ImageService.toImageResponse` (jangan duplikasi logika URL/variants). Urutan `gallery` = urutan `galleryImageIds`; id yang tidak ditemukan di-skip. `galleryImageIds` **tidak** dikembalikan ke FE.


```typescript
// libs/src/modules/category/entities/category.entity.ts
import { Prisma } from '@prisma/client';

export const categorySelect = {
  id: true,
  name: true,
  type: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

export type CategoryEntity = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
```

```typescript
// libs/src/modules/image/entities/image.entity.ts
import { Prisma } from '@prisma/client';

export const imageSelect = {
  id: true,
  entityType: true,
  entityId: true,
  key: true,
  filename: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  variants: true,
  order: true,
  createdAt: true,
} satisfies Prisma.ImageSelect;

export type ImageEntity = Prisma.ImageGetPayload<{ select: typeof imageSelect }>;

// elemen `variants` (disimpan di kolom Json, di-cast saat mapping):
export type ImageVariant = {
  name: 'large' | 'medium' | 'thumbnail';
  key: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
};
```

- `Post.categories` dikembalikan **flat** `[{ id, name, type }]` (lihat `mapPost`); FE langsung memakainya.
- `creator` sengaja minimal (`id`, `fullName`); tidak ada data sensitif.
- **`url` TIDAK disimpan di DB** dan **tidak** ada di `imageSelect`. URL dihitung saat mapping dari `key` (dan tiap `variants[].key`) + env `S3_PUBLIC_BASE_URL` di service:

```typescript
// libs/src/modules/image/image.service.ts (rencana)
constructor(private readonly config: ConfigService) {}

private toImageUrl(key: string): string {
  const base = this.config.getOrThrow<string>('S3_PUBLIC_BASE_URL').replace(/\/+$/, '');
  return `${base}/${key}`;
}

// response upload/list:
// - `url` = varian `large` (fallback original bila varian large tidak dibuat / kasus fallback)
// - `variants` = tiap varian + `url` hasil hitung
// - TIDAK membocorkan field internal (`entityType`, `entityId`, `order`, `createdAt`)
toImageResponse(image: ImageEntity) {
  const variants = (image.variants as unknown as ImageVariant[] | null) ?? [];
  const large = variants.find((v) => v.name === 'large');
  return {
    id: image.id,
    url: this.toImageUrl(large?.key ?? image.key),
    key: image.key,
    filename: image.filename,
    mimeType: image.mimeType,
    size: image.size,
    width: image.width,
    height: image.height,
    variants: variants.map((v) => ({ ...v, url: this.toImageUrl(v.key) })),
  };
}
```

- **Tidak ada** select yang menyertakan kolom sensitif (tidak ada di model ini).

---

## 4. DTO

Status validasi gagal = **422** (RULES bab 7). Kontrak 422: `{ statusCode: 422, message: 'Validation failed', errors: [{ field, message }] }`. Semua `@Param('id')` pakai `ParseUUIDPipe`.

```typescript
// libs/src/modules/post/dto/create-post.dto.ts
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ContentStatus } from '@prisma/client';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreatePostDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(SLUG_REGEX, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  // Tanggal publish manual (tombol "Terbitkan" di FE). Bila dikirim → status dipaksa PUBLISHED.
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  imageIds?: string[]; // id Image yang dipakai di content + thumbnail, di-bind ke post saat simpan

  // Urutan galeri = urutan array ini. Diganti seluruhnya bila dikirim saat update.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  galleryImageIds?: string[];
}
```

```typescript
// libs/src/modules/post/dto/update-post.dto.ts
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(OmitType(CreatePostDto, ['thumbnail'] as const)) {
  // `undefined` = jangan sentuh; `null` = hapus thumbnail.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string | null;
}
```

> `CreatePostDto.thumbnail` tetap `string` opsional. Hanya `UpdatePostDto` menerima `string | null`; service/repository membedakan `undefined` (jangan sentuh) vs `null` (set NULL).


```typescript
// libs/src/modules/image/dto/upload-image.dto.ts
import { IsIn, IsOptional } from 'class-validator';

export class UploadImageDto {
  // file binary ditangani FileInterceptor + @UploadedFile() (Express.Multer.File, memory storage),
  // bukan lewat class-validator (validasi mime/size di service → 422). Pipeline resize/kompresi
  // ([§9](#9-upload-gambar-s3--tabel-images)) berjalan SETELAH mime/size valid — tidak ada field form baru.
  @IsOptional()
  @IsIn(['post'])
  entityType?: string = 'post';
}
```

> `entityType` disiapkan agar tabel `images` **reusable** (mis. `event`, `user` di masa depan), bukan hanya post. Pada iterasi ini hanya `'post'` yang diizinkan; menambah nilai cukup menambah di `@IsIn([...])`. Form upload **tidak berubah** selain catatan ini — resize/kompresi internal, bukan field DTO.

```typescript
// libs/src/modules/category/dto/create-category.dto.ts
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class CreateCategoryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEnum(CategoryType)
  type: CategoryType;
}
```

```typescript
// libs/src/modules/category/dto/update-category.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
```

```typescript
// libs/src/modules/post/dto/list-posts-query.dto.ts
import { IsEnum, IsOptional } from 'class-validator';
import { ContentStatus } from '@prisma/client';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListPostsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(ContentStatus)
  filterStatus?: ContentStatus; // hanya bila ingin whitelist status via field khusus
}
```

```typescript
// libs/src/modules/category/dto/list-categories-query.dto.ts
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';

export class ListCategoriesQueryDto extends ListQueryDto {}
```

> Catatan: `filter` generik tetap `Record<string, unknown>` dari `ListQueryDto`; whitelist di-enforce di service/repository via konstanta (`POST_FILTER_FIELDS` dll — [§8](#8-kontrak-list-rules-bab-1919a19b)), bukan lewat dekorator DTO.

### Tabel validasi & contoh 422

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `name` (post) | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` | 422 `{ field: 'name', message }` |
| `slug` (post) | trim opsional, `@MaxLength(200)`, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` | 422 `{ field: 'slug', message }` |
| `content` | opsional, `@IsString()` | 422 `{ field: 'content', message }` |
| `thumbnail` | opsional, `@IsString()`, `@MaxLength(2048)`; pada `UpdatePostDto` boleh `null` (hapus) | 422 `{ field: 'thumbnail', message }` |
| `status` | opsional, `@IsEnum(ContentStatus)` | 422 `{ field: 'status', message }` |
| `publishedAt` | opsional, `@IsISO8601()`; bila ada → paksa `status=PUBLISHED` ([§6](#6-aturan-status)) | 422 `{ field: 'publishedAt', message }` |
| `categoryIds` | opsional, `@IsArray()`, `@IsUUID('4', { each: true })` | 422 `{ field: 'categoryIds.0', message }` |
| `imageIds` | opsional, `@IsArray()`, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(100)` | 422 `{ field: 'imageIds.0', message }` |
| `galleryImageIds` | opsional, `@IsArray()`, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(100)`; urutan = urutan galeri; update = replace seluruh array | 422 `{ field: 'galleryImageIds.0', message }` |
| `name` (category) | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(100)` | 422 `{ field: 'name', message }` |
| `type` (category) | `@IsEnum(CategoryType)` | 422 `{ field: 'type', message }` |
| `:id` path | `ParseUUIDPipe` | 422/400 UUID invalid |

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "name", "message": "name should not be empty" }]
}
```

### Tabel validasi upload (`POST /images`)

| Field | Aturan | Gagal → |
| --- | --- | --- |
| `file` | wajib ada; mime ∈ `image/png`, `image/jpeg`, `image/webp` | 422 `{ field: 'file', message: 'unsupported mime type' }` |
| `file` | size ≤ `UPLOAD_MAX_SIZE_MB` (default 5) MB | 422 `{ field: 'file', message: 'file too large' }` |
| `file` | batas juga ditegakkan di level Multer (`limits.fileSize`) → file besar tidak dibuffer penuh; `MulterError: LIMIT_FILE_SIZE` (Nest default **413**) dipetakan balik ke **422** oleh `MulterUploadInterceptor` | 422 `{ field: 'file', message: 'file too large' }` |
| `entityType` | opsional, `@IsIn(['post'])`, default `'post'` | 422 `{ field: 'entityType', message }` |
| `file` | setelah mime/size lolos → pipeline `sharp` resize/kompresi ([§9](#9-upload-gambar-s3--tabel-images)); file corrupt/tak bisa didecode | 422 `{ field: 'file', message: 'image could not be processed' }` |

```json
// 422 upload (mime tidak diizinkan / terlalu besar)
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "file", "message": "file must be one of: image/png, image/jpeg, image/webp (max 5 MB)" }]
}
```

---

## 5. Aturan Slug

`slug` = identifier unik untuk URL story.

**Saat create:**

1. `slug` **tidak dikirim** → server generate dari `name`:
   - lowercase → hapus diakritik (`NFD` + strip combining marks) → non-alnum → `-` → collapse `-+` → trim `-`.
   - helper util: `libs/src/modules/post/utils/slug.util.ts` → `slugify(name: string): string`.
   - `name` yang seluruhnya non-alnum → fallback `'story'` (atau timestamp), agar tidak menghasilkan slug kosong.
2. `slug` **dikirim** → validasi regex (422 bila tidak sesuai), pakai apa adanya.
3. Bentrok (P2002 / cek existing) → append `-2`, `-3`, dst sampai unik (idempoten, di dalam retry loop atau cek `findFirst`). Karena cek-lalu-insert rawan race, `create` **retry** maks 5× saat slug auto kena `P2002` (regenerate tiap percobaan). Slug **eksplisit** dari client yang bentrok **tidak** di-retry → tetap **409**.

**Saat update:**

- `slug` hanya berubah bila field `slug` **eksplisit dikirim** di body.
- Bila `slug` bentrok dengan story lain → **409** `ConflictException` (bukan auto-suffix — update dianggap niat eksplisit user).
- `name` berubah **tanpa** `slug` → slug **tidak** ikut berubah (slug stabil untuk SEO).

```typescript
// libs/src/modules/post/utils/slug.util.ts (rencana)
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'story';
}

// dipakai di service saat create tanpa slug + resolve bentrok:
async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 2; ; i++) {
    const exists = await this.postRepository.existsBySlug(slug);
    if (!exists) return slug;
    slug = `${base}-${i}`;
  }
}
```

---

## 6. Aturan Status

- Default `status` = `DRAFT` (schema `@default(DRAFT)`).
- **Tidak ada penjadwalan otomatis.** Tidak ada worker/cron dan **tidak ada endpoint publish terpisah**. Tanggal publish dipilih user dan dikirim di body `POST/PATCH` lewat field opsional `publishedAt`; backend hanya menyimpannya.
- `publishedAt` **opsional** di `CreatePostDto` & `UpdatePostDto` (diwarisi `UpdatePostDto` via `PartialType(OmitType(...))` — tidak ter-omit), tipe `string` ISO 8601, divalidasi `@IsISO8601()` → non-ISO = **422**.
- **Create:**
  - `publishedAt` dikirim → `publishedAt = new Date(dto.publishedAt)` **dan** paksa `status = PUBLISHED` (tanggal publish menyiratkan terbit; `status` yang dikirim diabaikan).
  - `publishedAt` tidak dikirim → perilaku lama: `publishedAt = now` hanya bila `status = PUBLISHED`, `null` bila tidak.
- **Update:**
  - `publishedAt` dikirim → `publishedAt = new Date(dto.publishedAt)` (**menimpa** nilai lama — untuk ubah/backdate jadwal terbit) **dan** `status = PUBLISHED`. `publishedAt` menang atas `status` bila keduanya dikirim.
  - `publishedAt` tidak dikirim → perilaku lama: menaikkan `status` ke `PUBLISHED` mengisi `publishedAt = now` hanya bila masih `null` (re-publish tidak mengubah waktu publish pertama); `APPROVED` mengisi `approvedAt = now` bila masih `null`.
- `approvedAt` **tidak** dapat dikirim client (tidak ada di DTO) → kirim `approvedAt` = **422** (`forbidNonWhitelisted`). `approvedAt` tetap server-managed dan tidak disentuh oleh `publishedAt`.
- `galleryImageIds` tidak memengaruhi aturan status: pada create/update ia disimpan apa adanya (update = replace seluruh array) dan id galeri ikut di-bind ke post (union `imageIds` + `galleryImageIds`) — lihat [§9](#9-upload-gambar-s3--tabel-images).

```typescript
// libs/src/modules/post/post.service.ts
// create
const autoPublish = dto.publishedAt !== undefined;
status: autoPublish ? ContentStatus.PUBLISHED : status,
publishedAt: autoPublish ? new Date(dto.publishedAt!) : status === ContentStatus.PUBLISHED ? now : undefined,

// update
if (dto.publishedAt !== undefined) {
  data.publishedAt = new Date(dto.publishedAt);
  data.status = ContentStatus.PUBLISHED;
} else if (dto.status !== undefined) {
  data.status = dto.status;
  if (dto.status === ContentStatus.PUBLISHED && !existing.publishedAt) data.publishedAt = new Date();
  if (dto.status === ContentStatus.APPROVED && !existing.approvedAt) data.approvedAt = new Date();
}
```

---

## 7. Repository & Service

### Post

| Method | Fungsi |
| --- | --- |
| `findAll(query, where)` | List paginated (`skip/take`, `count`), `select: postSelect`, sertakan `categories` + `creator`. |
| `findById(id)` | Detail; `select: postSelect`; tidak ada → `NotFoundException`. |
| `existsBySlug(slug)` | Cek bentrok slug (create). |
| `create(data)` | Insert + link `categoryIds` via nested `categories: { create: [...] }`; map `P2002` → `ConflictException`. |
| `update(id, data)` | Update; replace link kategori (`deleteMany` + `createMany` dalam `$transaction`); map `P2002` → 409. |
| `delete(id)` | Hapus; `post_categories` cascade otomatis (FK `onDelete: Cascade`). |

`categoryIds` saat update = **replace set** (bukan append): hapus semua `PostCategory` milik post lalu buat ulang dari daftar baru, di dalam `$transaction`.

### Category

| Method | Fungsi |
| --- | --- |
| `findAll(type?)` | List; `filter[type]` memfilter `type`. |
| `findById(id)` | Detail; tidak ada → `NotFoundException`. |
| `createIdempotent(data)` | Cek `findFirst({ where: { name: { equals, mode: 'insensitive' }, type } })`; bila ada → **kembalikan yang existing (bukan 409)**; bila tidak → create. |
| `update(id, data)` | Update nama/tipe; `P2002` → 409 (bila ada unique di masa depan; saat ini name tidak unik). |
| `delete(id)` | Hapus kategori; `post_categories` cascade (FK `onDelete: Cascade`) → link di post ikut terhapus, story **tidak** terhapus. |

**Keputusan `createIdempotent`:** halaman story punya fitur inline-add kategori. Bila user mengetik kategori yang sudah ada, endpoint tetap sukses dan mengembalikan kategori existing — mencegah 409 yang mengganggu UX dan mencegah duplikat baris kategori.

**Keputusan hapus kategori yang masih dipakai post:** tetap **boleh** (cascade). Link `post_categories` terhapus, story tetap hidup tanpa kategori tersebut. Alasan: kategori bersifat taksonomi, bukan data kritikal story; memblokir hapus akan membuat admin terjebak kategori usang. Trade-off: tidak ada konfirmasi backend — FE wajib menampilkan konfirmasi sebelum `DELETE`. (Kebalikan dari role.md yang memblokir hapus role yang masih dipakai user.)

```typescript
// libs/src/modules/post/post.repository.ts (rencana)
async findAll(query: ListQueryDto, where: Prisma.PostWhereInput) {
  const page = query.page ?? 1;
  const take = Math.min(query.limit ?? 20, 100);
  const skip = (page - 1) * take;

  const [items, total] = await this.prisma.$transaction([
    this.prisma.post.findMany({ where, orderBy, skip, take, select: postSelect }),
    this.prisma.post.count({ where }),
  ]);

  return { items, total };
}
```

```typescript
// libs/src/modules/category/category.repository.ts (rencana)
async createIdempotent(data: { name: string; type: CategoryType }): Promise<CategoryEntity> {
  const existing = await this.prisma.category.findFirst({
    where: { name: { equals: data.name, mode: 'insensitive' }, type: data.type },
    select: categorySelect,
  });
  if (existing) return existing;
  return this.prisma.category.create({ data, select: categorySelect });
}
```

### Image

Service/repo `image` dapat berdiri sendiri (`libs/src/modules/image/`) atau dititipkan di modul `post`; brief ini memilih **modul `image`** agar `entityType` reusable. Repository satu-satunya tempat query `images`.

| Method | Fungsi |
| --- | --- |
| `create(data)` | Insert row `Image` (`entityType='post'`, `entityId=null`, `key`=original, `filename`, `mimeType`/`size`/`width`/`height` = original, `variants` = array varian, `order=0`); `select: imageSelect`. |
| `deleteByEntity(entityType, entityId)` | `deleteMany({ where: { entityType, entityId } })`; kembalikan `key[]` = **original + semua `variants[].key`** (bukan hanya `key`) untuk hapus objek S3. |
| `findByIds(ids)` | `findMany({ where: { id: { in: ids } }, select: imageSelect })`; validasi kepemilikan/keberadaan id. |

`ImageProcessor` (`sharp`) + `StorageService` (S3) diletakkan di **`libs/src/integrations/`** (RULES bab 2: klien eksternal → `integrations/`). `StorageService` bungkus `@aws-sdk/client-s3` (`PutObjectCommand`, `DeleteObjectsCommand`), konfigurasi region/bucket/kredensial dari env, dan **jangan** ekspos kredensial ke response/log. `ImageProcessor` bungkus `sharp`: derive varian + dimensi dari buffer ([§9](#9-upload-gambar-s3--tabel-images)). Service `image` mengorkestrasi: validasi → `ImageProcessor.process` → `Promise.all` upload S3 (original + varian) → `repo.create`.

---

## 8. Kontrak List (RULES bab 19/19a/19b)

Semua list paginated via `ListQueryDto` shared (`page, limit, sortBy, sortOrder, search, filter`). `limit` clamp 100; response `{ data, meta: { page, limit, total }, message }`.

### `GET /api/v1/posts`

| Item | Nilai |
| --- | --- |
| `POST_SEARCHABLE_FIELDS` | `['name', 'slug']` |
| `POST_SORT_FIELDS` | `['name', 'slug', 'status', 'publishedAt', 'createdAt', 'updatedAt']` |
| `POST_FILTER_FIELDS` | `['status', 'publishedAt', 'createdAt', 'updatedAt']` |
| `POST_DATE_FIELDS` | `['publishedAt', 'createdAt', 'updatedAt']` (ISO 8601; invalid → 422; `like` ditolak) |
| `sortOrder` default | `desc` (`sortBy` default `createdAt`) |
| Item select | `postSelect` → termasuk `categories` + `creator` |
| `meta` | `{ page, limit, total }` |

- `search` → OR `like insensitive` ke `name, slug`; trim, kosong/<2 char diabaikan (`buildSearch`).
- `filter` value kosong (`filter[status]=`) diabaikan; enum invalid → 422; tanggal non-ISO → 422.
- `sortBy` di luar whitelist → 422 (`assertAllowedSort`).

### `GET /api/v1/categories`

| Item | Nilai |
| --- | --- |
| `CATEGORY_SEARCHABLE_FIELDS` | `['name']` |
| `CATEGORY_SORT_FIELDS` | `['name', 'type', 'createdAt', 'updatedAt']` |
| `CATEGORY_FILTER_FIELDS` | `['type', 'name', 'createdAt', 'updatedAt']` |
| `CATEGORY_DATE_FIELDS` | `['createdAt', 'updatedAt']` (ISO 8601; invalid → 422; `like` ditolak) |
| Item select | `categorySelect` |

- Halaman story memanggil: `GET /api/v1/categories?filter[type]=STORY&limit=100` untuk mengisi dropdown kategori.

### Contoh query

- `GET /api/v1/posts?page=1&limit=20&sortBy=publishedAt&sortOrder=desc&filter[status]=PUBLISHED`
- `GET /api/v1/posts?search=gamelan&sortBy=name&sortOrder=asc`
- `GET /api/v1/posts?filter[createdAt][gte]=2026-09-01T00:00:00Z`
- `GET /api/v1/categories?filter[type]=STORY&limit=100`
- `GET /api/v1/categories?search=musik&sortBy=name&sortOrder=asc`

### Contoh respons list

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sejarah Gamelan di Eropa",
      "slug": "sejarah-gamelan-di-eropa",
      "status": "PUBLISHED",
      "publishedAt": "2026-09-10T10:00:00.000Z",
      "approvedAt": "2026-09-09T08:00:00.000Z",
      "thumbnail": "https://cdn.example.com/posts/2f9c...ab.png",
      "creator": { "id": "u-1", "fullName": "Budi" },
      "categories": [{ "id": "c-1", "name": "Musik", "type": "STORY" }],
      "createdAt": "2026-09-01T00:00:00.000Z",
      "updatedAt": "2026-09-10T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 },
  "message": "success"
}
```

---

## 9. Upload Gambar (S3 + tabel images)

Gambar disimpan di **Amazon S3** (atau S3-compatible: MinIO/localstack), metadata di tabel `Image`. **Tidak ada** penyimpanan filesystem lokal dan **tidak ada** `GET /uploads`.

### `POST /api/v1/images`

| Item | Nilai |
| --- | --- |
| Content-Type | `multipart/form-data`, field file `file` |
| Auth | PERMISSION `story:create` **atau** `story:update` (ANY-of: `@Permissions('story:create', 'story:update')`) |
| Validasi mime | hanya `image/png`, `image/jpeg`, `image/webp` → lainnya **422** |
| Validasi ukuran | max `UPLOAD_MAX_SIZE_MB` (default **5** MB) → lebih → **422** |
| Key S3 original | `posts/original/<uuid>.<ext>` (ext dari mime original) |
| Key S3 varian | `posts/<uuid>-large.webp`, `posts/<uuid>-medium.webp`, `posts/<uuid>-thumb.webp` |
| Response 201 | `{ data: { id, url, key, filename, mimeType, size, width, height, variants: [{ name, url, key, width, height, size, mimeType }] }, message }` |
| `url` | varian **`large`** (fallback original bila varian large tidak dibuat); **absolut**: `${S3_PUBLIC_BASE_URL}/<key>` (dihitung saat mapping, tidak disimpan di DB) |

Alur:

1. Validasi mime + size (`file` dari `@UploadedFile()`), gagal → 422.
2. Pipeline `sharp` resize/kompresi (lihat sub-bagian di bawah) pada buffer memory; original **tidak** di-re-encode.
3. Generate key original `posts/original/<uuid>.<ext>` + key varian `posts/<uuid>-<name>.webp`.
4. `PutObject` ke S3 (`StorageService`) original + varian, **paralel** (`Promise.all`).
5. `image.create` dengan `entityType='post'`, `entityId=null`, `key` = key original, `filename` (nama original), `mimeType`/`size`/`width`/`height` = **original**, `variants` = array varian, `order=0`.
6. Response `201` dengan `url` varian `large` (atau original bila tak ada varian).

```typescript
// apps/app/src/controllers/images.controller.ts (rencana)
@Post('images')
@Permissions('story:create', 'story:update') // ANY-of (PermissionsGuard: required.some(...))
@UseInterceptors(FileInterceptor('file'))
create(
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: UploadImageDto,
) {
  return this.imageService.upload(file, dto.entityType ?? 'post');
}
```

### Pipeline resize/kompresi (`sharp`)

**Keputusan:** setiap gambar diproses resize + kompresi. Original **tetap disimpan utuh** (tanpa re-encode) → jaminan kualitas + sumber re-derive; varian teroptimasi dibuat untuk delivery.

- **Library**: `sharp` (dependency baru; native binary). Dijalankan di `ImageProcessor` (bagian `libs/src/integrations/`, [§7](#7-repository--service)).
- **Urutan proses**: `file.buffer` (Multer **memory storage**, bukan disk) → `sharp(buffer).rotate()` (auto-orient dari EXIF) → `.withMetadata(false)` (setara hapus metadata) → derive varian → encode.
- **Original**: simpan file asli di S3 key `posts/original/<uuid>.<ext>` (utuh, tanpa re-encode). Row `Image.key` menunjuk original; `mimeType/size/width/height` = original.
- **Varian turunan** (semua **WebP**, `quality: 82`, `effort: 4`):

| Nama | Resize | Key |
| --- | --- | --- |
| `large` | `resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })` | `posts/<uuid>-large.webp` |
| `medium` | max 1024 (`fit: 'inside'`, `withoutEnlargement: true`) | `posts/<uuid>-medium.webp` |
| `thumbnail` | `resize({ width: 480, height: 480, fit: 'cover' })` | `posts/<uuid>-thumb.webp` |

- **Downscale-only**: `withoutEnlargement: true` → gambar kecil **tidak** diperbesar. Rasio aspek dipertahankan (kecuali `thumbnail` yang `fit: 'cover'`).
- **Keputusan varian yang tidak lebih kecil dari original**: varian **tetap dibuat** (konsistensi URL), **kecuali** bila output `large` `size >= original.size` → pakai **original** sebagai `large` (tidak ada key `-large.webp`; fallback di service).
- **GIF tidak didukung** (dihapus dari `ALLOWED_MIME`/`EXT_BY_MIME` di `image.service.ts` + `MulterUploadInterceptor`). Upload GIF → **422** `unsupported mime type` / `file must be one of: ...`. Cabang GIF di `ImageProcessor` tidak terpakai.
- `variants` (name, key, width, height, size, mimeType) disimpan ke kolom Json row `Image`. Upload objek original + varian ke S3 **paralel** (`Promise.all`).
- **Sinkron di request**: `sharp` cepat untuk file ≤ 5 MB. Upgrade path: **async worker** (`libs/src/commands/`) untuk file besar/latensi tinggi.
- **Kegagalan proses gambar** (file corrupt / tak bisa didecode) → **422** `{ field: 'file', message: 'image could not be processed' }`; kegagalan S3 → 500/502. Detail kredensial **jangan** dibocorkan.
- **Biaya storage**: original + 3 varian per gambar (lebih besar dari tanpa optimasi). Trade-off diterima karena requirement "tanpa mengurangi kualitas" → original wajib disimpan.

### Penyajian gambar

- **Tidak ada** `GET /uploads` lagi. File dilayani langsung oleh S3/CDN memakai `url` absolut di `content`/`thumbnail`.
- Bucket **public-read** (atau via CloudFront) supaya `<img src>` di HTML bertahan tanpa signed URL kedaluwarsa. Ini **keputusan sadar**: signed URL akan membuat gambar di story lama mati saat kedaluwarsa — tidak cocok untuk konten publik.
- Konsekuensi: `Content-Type` di-set saat `PutObject`; nama key UUID non-guessable.

### Binding ke post

- Saat `POST /posts` / `PATCH /posts/:id`, FE mengirim daftar id `Image` lewat `imageIds` (gambar di `content` **dan** `thumbnail`) dan `galleryImageIds` (galeri berurut).
- Service meng-`updateMany` row `Image` pada **union** `imageIds` + `galleryImageIds` → set `entityId = post.id` (dan pastikan `entityType='post'`). Pada **create**, post dibuat dulu (mendapat `id`) lalu binding di dalam `$transaction`.
- `thumbnail` tetap URL string absolut (FE mengirim URL + id-nya lewat `imageIds` agar baris ter-bind).
- Id di `imageIds`/`galleryImageIds` yang tidak ada / bukan milik upload post → abaikan atau 422 (ditentukan saat implementasi; minimal jangan bind id milik entity lain). `bindImages` hanya menyentuh row yang `entityId=null` atau sudah milik post ini.
- **Unbind galeri saat update.** `PATCH /posts/:id` yang mengirim `galleryImageIds` = replace seluruh array. Selisih id lama yang tidak lagi ada di array baru (`removedGalleryImageIds = existing.galleryImageIds − dto.galleryImageIds`) di-`unbindImages` (set `entityId = null`) dalam transaksi yang sama dengan bind. Ini mencegah gambar lama tetap menempel `entityId = postId` sehingga tak bisa dipakai post lain. Hanya berlaku untuk galeri; `imageIds` inline/thumbnail lama **tidak** di-unbind (FE tidak mengirim ulang id lama, unbind justru salah). Objek S3 & row `images` tidak dihapus (tetap orphan — batasan existing, lihat [§9 Orphan](#orphan)).

### Galeri post (`galleryImageIds` → `gallery`)

- `Post.galleryImageIds` = `String[]` (Postgres `TEXT[]`, `@default([])`, kolom `gallery_image_ids`). Urutan array = urutan galeri.
- **Create/update**: disimpan apa adanya; pada update, `galleryImageIds` dikirim → **replace seluruh array** (tidak ada saat tidak dikirim = jangan sentuh).
- **Response** (`GET /posts`, `GET /posts/:id`, `POST/PATCH/DELETE /posts`): field `gallery: ImageResponse[]` berurut sesuai `galleryImageIds`, bentuk sama dengan respons `POST /images` (`{ id, url, key, filename, mimeType, size, width, height, variants: [{ name, url, key, width, height, size, mimeType }] }`). `galleryImageIds` mentah **tidak** dikembalikan.
- Resolusi lewat `ImageRepository.findByIds` + `ImageService.toImageResponse` (tidak menduplikasi logika URL/variants). List mengambil semua id unik sekali (hindari N+1), lalu menyusun ulang per post. Id yang tidak ditemukan di-skip.

```json
// potongan response post detail
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "gallery": [
      {
        "id": "2f9c1b7a-...",
        "url": "https://cdn.example.com/posts/2f9c1b7a-...-large.webp",
        "key": "posts/original/2f9c1b7a-....png",
        "filename": "gamelan.png",
        "mimeType": "image/png",
        "size": 204800,
        "width": 1600,
        "height": 900,
        "variants": [
          { "name": "large", "url": "https://cdn.example.com/posts/2f9c1b7a-...-large.webp", "key": "posts/2f9c1b7a-...-large.webp", "width": 1600, "height": 900, "size": 120000, "mimeType": "image/webp" }
        ]
      }
    ]
  },
  "message": "success"
}
```

### Hapus post (`DELETE /posts/:id`)

- `deleteMany` row `Image` dengan `entityType='post'`, `entityId=id`; kumpulkan `key[]` = **original + semua `variants[].key`** (bukan hanya `key`).
- Hapus objek S3 via `DeleteObjectsCommand` (best-effort).
- Lanjut hapus post.
- **Orkestrasi**: DB delete dulu (sumber kebenaran), S3 best-effort + `log.warn` bila gagal. Kegagalan S3 tidak menggagalkan response (objek yatim di S3 bisa dibersihkan worker).

### Orphan

Gambar yang diupload lalu draft dibatalkan, atau gambar inline yang dihapus dari `content`, **tidak otomatis terhapus** pada iterasi ini → TODO worker/cleanup (sebut `libs/src/commands/`). Kandidat: row `Image` dengan `entityId=null` + `createdAt` lebih lama dari ambang (mis. 24 jam).

### Simplifikasi sadar

- **Resize/optimasi sinkron di request** (pipeline `sharp` di atas); `width`/`height` diisi. Upgrade path: pindah ke async worker (`libs/src/commands/`) untuk file besar/latensi tinggi.
- **Presigned URL tidak dipakai** pada iterasi ini: upload lewat API sehingga kredensial S3 tidak diekspos ke browser dan tidak perlu CORS S3. Upgrade path bila volume upload besar: presigned PUT langsung ke S3.
- Dependency baru: `sharp` (runtime, native binary), `@aws-sdk/client-s3` (runtime), `@types/multer` (dev; Multer sudah dari `@nestjs/platform-express`).

### Env baru

Wajib lewat `@nestjs/config` (RULES bab 8), bukan `process.env` tersebar. Tambahkan validasi Joi di `libs/src/common/config/env.validation.ts` (pola `internalBase` / `appEnvValidationSchema`).

| Env | Wajib | Default | Keterangan |
| --- | --- | --- | --- |
| `S3_REGION` | ya | — | region bucket, mis. `ap-southeast-1` |
| `S3_BUCKET` | ya | — | nama bucket |
| `S3_ACCESS_KEY_ID` | ya | — | kredensial; **jangan** di-log/response |
| `S3_SECRET_ACCESS_KEY` | ya | — | kredensial; **jangan** di-log/response |
| `S3_PUBLIC_BASE_URL` | ya | — | base URL publik (bucket/CDN), dipakai `toImageUrl(key)` |
| `S3_ENDPOINT` | tidak | — | override endpoint untuk MinIO/localstack |
| `UPLOAD_MAX_SIZE_MB` | tidak | `5` | batas ukuran upload |
| `IMAGE_WEBP_QUALITY` | tidak | `82` | kualitas encode WebP varian |
| `IMAGE_LARGE_WIDTH` | tidak | `1920` | lebar maks varian `large` |
| `IMAGE_MEDIUM_WIDTH` | tidak | `1024` | lebar maks varian `medium` |
| `IMAGE_THUMB_SIZE` | tidak | `480` | sisi varian `thumbnail` (`fit: 'cover'`) |

Contoh Joi (rencana):

```typescript
S3_REGION: Joi.string().required(),
S3_BUCKET: Joi.string().required(),
S3_ACCESS_KEY_ID: Joi.string().required(),
S3_SECRET_ACCESS_KEY: Joi.string().required(),
S3_PUBLIC_BASE_URL: Joi.string().uri().required(),
S3_ENDPOINT: Joi.string().uri().optional(),
UPLOAD_MAX_SIZE_MB: Joi.number().integer().min(1).default(5),
IMAGE_WEBP_QUALITY: Joi.number().integer().min(1).max(100).default(82),
IMAGE_LARGE_WIDTH: Joi.number().integer().min(1).default(1920),
IMAGE_MEDIUM_WIDTH: Joi.number().integer().min(1).default(1024),
IMAGE_THUMB_SIZE: Joi.number().integer().min(1).default(480),
```

---

## 10. Permission & Seed

Usulan penambahan ke `DEFAULT_PERMISSIONS` di `libs/prisma/seed.ts`:

```typescript
const DEFAULT_PERMISSIONS = [
  // ... 12 code RBAC existing ...
  { code: 'story:create', description: 'Membuat story baru' },
  { code: 'story:read', description: 'Melihat daftar/detail story' },
  { code: 'story:update', description: 'Mengubah story' },
  { code: 'story:delete', description: 'Menghapus story' },
  { code: 'category:create', description: 'Membuat kategori baru' },
  { code: 'category:read', description: 'Melihat daftar/detail kategori' },
  { code: 'category:update', description: 'Mengubah kategori' },
  { code: 'category:delete', description: 'Menghapus kategori' },
];
```

- Role **`admin`** otomatis mendapat semuanya: `DEFAULT_ROLES[0].permissions = DEFAULT_PERMISSIONS.map(p => p.code)` (perilaku seed existing, additive, idempoten).
- Jalankan `pnpm prisma:seed` setelah menambah code.
- Permission `story:read` juga dipakai `GET /posts`; `category:read` untuk `GET /categories`.

### Keputusan permission upload

- Upload gambar (`POST /images`) **cukup** memakai `story:create` / `story:update` (ANY-of). **Tidak** ada permission baru `image:create` / `image:delete` supaya tidak menambah beban seed.
- **`image:read` tidak perlu**: gambar dilayani S3 publik, tidak ada endpoint baca via API.
- Konsekuensi: tabel `images` reusable lintas entity, tetapi otorisasi tetap mengikuti permission modul pemilik (`story:*`). Bila `entityType` lain (mis. `event`) ditambah, tambahkan permission modul tersebut saat itu.

### TODO sinkronisasi `rbac.md §8`

Tambahkan baris ringkas ke tabel endpoint `rbac.md §8` (jangan edit file ini sekarang):

| Method | Path | Deskripsi | Akses |
| --- | --- | --- | --- |
| POST | `/api/v1/posts` | Buat story | PERMISSION: `story:create` |
| GET | `/api/v1/posts` | List story | PERMISSION: `story:read` |
| GET | `/api/v1/posts/:id` | Detail story | PERMISSION: `story:read` |
| PATCH | `/api/v1/posts/:id` | Update story | PERMISSION: `story:update` |
| DELETE | `/api/v1/posts/:id` | Hapus story | PERMISSION: `story:delete` |
| POST | `/api/v1/categories` | Buat kategori | PERMISSION: `category:create` |
| GET | `/api/v1/categories` | List kategori | PERMISSION: `category:read` |
| GET | `/api/v1/categories/:id` | Detail kategori | PERMISSION: `category:read` |
| PATCH | `/api/v1/categories/:id` | Update kategori | PERMISSION: `category:update` |
| DELETE | `/api/v1/categories/:id` | Hapus kategori | PERMISSION: `category:delete` |
| POST | `/api/v1/images` | Upload gambar ke S3 | PERMISSION: `story:create`, `story:update` (ANY-of) |

---

## 11. Tabel Endpoint Lengkap

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta, message }`; error `{ statusCode, message, errors }`.

| Method | Path | Akses / Permission | Request | Response sukses | Error |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/posts` | PERMISSION `story:create` | body `CreatePostDto` (termasuk `imageIds`, `galleryImageIds`; `publishedAt` opsional ISO 8601 → paksa `PUBLISHED`) | 201 `{ data: <post + gallery>, message }` | 422 validasi, 409 slug duplikat, 401/403 |
| GET | `/api/v1/posts` | PERMISSION `story:read` | query `ListPostsQueryDto` | 200 `{ data: [post + gallery], meta, message }` | 422 sortBy/filter tak dikenal, 401/403 |
| GET | `/api/v1/posts/:id` | PERMISSION `story:read` | path `id` UUID | 200 `{ data: <post + gallery>, message }` | 404, 422 UUID invalid, 401/403 |
| PATCH | `/api/v1/posts/:id` | PERMISSION `story:update` | path `id`, body `UpdatePostDto` (termasuk `imageIds`, `galleryImageIds`; `publishedAt` opsional ISO 8601 → timpa + paksa `PUBLISHED`) | 200 `{ data: <post + gallery>, message }` | 404, 409 slug duplikat, 422, 401/403 |
| DELETE | `/api/v1/posts/:id` | PERMISSION `story:delete` | path `id` (ikut hapus row `images` + objek S3) | 200 `{ data: <post + gallery>, message }` | 404, 422 UUID invalid, 401/403 |
| POST | `/api/v1/categories` | PERMISSION `category:create` | body `CreateCategoryDto` | 201 `{ data: <category>, message }` | 422, 401/403 |
| GET | `/api/v1/categories` | PERMISSION `category:read` | query `ListCategoriesQueryDto` | 200 `{ data: [category], meta, message }` | 422, 401/403 |
| GET | `/api/v1/categories/:id` | PERMISSION `category:read` | path `id` UUID | 200 `{ data: <category>, message }` | 404, 422 UUID invalid, 401/403 |
| PATCH | `/api/v1/categories/:id` | PERMISSION `category:update` | path `id`, body `UpdateCategoryDto` | 200 `{ data: <category>, message }` | 404, 422, 401/403 |
| DELETE | `/api/v1/categories/:id` | PERMISSION `category:delete` | path `id` | 200 `{ data: <category>, message }` | 404, 422 UUID invalid, 401/403 |
| POST | `/api/v1/images` | PERMISSION `story:create` **atau** `story:update` | multipart field `file` (+ `entityType` opsional) | 201 `{ data: { id, url, key, filename, mimeType, size, width, height, variants: [{ name, url, key, width, height, size, mimeType }] }, message }` | 422 mime/ukuran/file corrupt, 502/500 S3 gagal, 401/403 |

---

## 12. Tabel Error / Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `POST/PATCH /posts` | `ConflictException` | 409 | `slug` duplikat (P2002 / bentrok eksplisit) |
| `GET/PATCH/DELETE /posts/:id` | `NotFoundException` | 404 | post tidak ditemukan |
| `GET/PATCH/DELETE /categories/:id` | `NotFoundException` | 404 | kategori tidak ditemukan |
| semua create/update | `UnprocessableEntityException` | 422 | validasi DTO |
| `GET /posts`, `GET /categories` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, enum/tanggal invalid |
| `POST /images` | `UnprocessableEntityException` | 422 | mime tidak diizinkan / file > `UPLOAD_MAX_SIZE_MB` |
| `POST /images` | `UnprocessableEntityException` | 422 | file corrupt / tak bisa diproses `sharp` (`{ field: 'file', message: 'image could not be processed' }`) |
| `POST /images` | `BadGatewayException` | 502 | `PutObject` ke S3 gagal (mis. kredensial/endpoint/network). Pesan generik, **jangan** bocorkan kredensial. |
| `POST /images` | `InternalServerErrorException` | 500 | error tak terduga saat upload / insert `Image` |
| semua | `UnauthorizedException` | 401 | JWT tidak ada / invalid / expired |
| semua | `ForbiddenException` | 403 | JWT valid tapi permission kurang |
| semua | `BadRequestException` | 400 | payload/query tidak dapat dipahami |

Format error standar: `{ statusCode, message, errors }` (RULES bab 5).

```json
// 409 slug duplikat
{ "statusCode": 409, "message": "Slug already exists", "errors": [] }

// 422 validasi
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "status", "message": "status must be one of the following values: DRAFT, REQUEST, APPROVED, PUBLISHED" }]
}
```

---

## 13. Status & Catatan

**SUDAH DIIMPLEMENTASIKAN (backend).** Kontrak di brief ini sudah tersedia; endpoint siap dipanggil FE (asal env S3 di-set untuk upload).

### Sudah jadi

- **Migration `add_posts_categories`** diterapkan (DB lokal): `ALTER TABLE images` (`variants JSONB`, `entity_id` nullable, `order` default 0, `key` unique). Tabel `posts`/`categories`/`post_categories` sudah ada dari migration init repo. `pnpm prisma:generate` sukses.
- **Migration `add_post_gallery_image_ids`** ditambahkan: `ALTER TABLE "posts" ADD COLUMN "gallery_image_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`.
- **Module** `libs/src/modules/post/` (repo/service/dto/entities/utils `slugify`), `category/` (repo/service/dto/entities), `image/` (repo/service/dto/entities + `toImageResponse`).
- **Integrations** `libs/src/integrations/storage/`: `StorageService` (S3, lazy init), `ImageProcessor` (`sharp`), `StorageModule`.
- **Controllers** `apps/app/src/controllers/{posts,categories,images}.controller.ts`; terdaftar di `apps/app/src/app.module.ts` (+ `LibsModule`).
- **Env** Joi (`S3_*`, `UPLOAD_MAX_SIZE_MB`, `IMAGE_*`) + `.env.example`. Kredensial S3 `optional` agar boot tanpa S3 tidak crash; guard saat upload.
- **Seed** 8 permission `story:*` / `category:*` di `libs/prisma/seed.ts` (jalankan `pnpm prisma:seed`).
- Build `pnpm build:app` + `pnpm build:worker` hijau.

### Belum / TODO lanjutan

1. **Async processing worker** (`libs/src/commands/`) untuk resize/kompresi di luar request cycle (file besar/latensi tinggi).
2. **Orphan cleanup worker**: hapus row `Image` `entityId=null` lama + objek S3-nya (**original + semua varian**).
3. **Presigned URL** bila volume upload besar (iterasi ini upload lewat API).
4. Jalankan `pnpm prisma:seed` + set env S3 nyata di lingkungan deploy.

### Catatan untuk FE

- Endpoint **siap**; jangan ubah kontrak brief ini.
- Kontrak penting: `slug` opsional (server generate bila kosong); `status` server-managed kecuali `publishedAt` dikirim manual; `publishedAt` opsional di body POST/PATCH (ISO 8601, menimpa + paksa `PUBLISHED`, tanpa penjadwalan otomatis); `approvedAt` tetap server-managed (kirim → 422); `categories` item **flat** `[{ id, name, type }]`; inline-add kategori lewat `POST /categories` bersifat idempoten (aman dari 409). `PATCH /posts/:id` dengan `"thumbnail": null` menghapus thumbnail.
- **Galeri**: kirim `galleryImageIds: string[]` (urutan = urutan galeri) di body `POST/PATCH`; `PATCH` **replace** seluruh array. Response `GET /posts` & `GET /posts/:id` mengembalikan `gallery: ImageResponse[]` berurut (bentuk sama dengan respons `POST /images`); field mentah `galleryImageIds` tidak dikembalikan.
- **GIF tidak didukung**: mime upload hanya `image/png`, `image/jpeg`, `image/webp`; GIF → 422.
- Gambar: upload ke `POST /images` (multipart `file`) → response `url` absolut S3; sisipkan `url` di `content`/`thumbnail`; kirim id `Image` via `imageIds` (konten/thumbnail) dan `galleryImageIds` (galeri) saat create/update post agar ter-bind; render `<img src>` langsung (bucket public-read).
