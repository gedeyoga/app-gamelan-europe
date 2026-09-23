# Module: Event

Menu: [rbac.md](./rbac.md) (master) · [story.md](./story.md) (pola acuan)

> **STATUS: DIIMPLEMENTASIKAN (backend).** Module `event` + `event-type`, controller, whitelist `entityType` image, seed permission `event:*` tersedia. Mirror modul `post`/`category`.

---

## 1. Deskripsi & Lokasi

Modul **`event`** mengelola `Event` (kegiatan). Berbeda dari `Post`:

- **Tidak punya `galleryImageIds`** → tidak ada galeri.
- Punya **multi** `event_dates`, **multi** `event_types` (join `assign_event_types`), dan **tepat satu** `event_locations` (wajib).
- `event_types` diperlakukan seperti `categories` → boleh inline create via `createIdempotent`.

```
libs/src/modules/event/
├── event.repository.ts
├── event.service.ts
├── event.module.ts
├── dto/
│   ├── create-event.dto.ts
│   ├── update-event.dto.ts
│   └── list-events-query.dto.ts
├── entities/
│   └── event.entity.ts
└── utils/
    └── slug.util.ts

libs/src/modules/event-type/
├── event-type.repository.ts
├── event-type.service.ts
├── event-type.module.ts
├── dto/
│   └── create-event-type.dto.ts
└── entities/
    └── event-type.entity.ts

apps/app/src/controllers/
├── events.controller.ts
└── event-types.controller.ts
```

Alur baku `Controller → Service → Repository → Prisma`; repository satu-satunya tempat query Prisma.

---

## 2. Model Prisma

```prisma
enum ContentVisibility {
  PUBLIC
  PRIVATE
}

model Event {
  id          String            @id @default(uuid())
  name        String
  slug        String            @unique
  status      ContentStatus     @default(DRAFT)
  publishedAt DateTime?         @map("published_at")
  approvedAt  DateTime?         @map("approved_at")
  content     String
  thumbnail   String?
  visibility  ContentVisibility @default(PUBLIC)
  createdBy   String?           @map("created_by")
  creator     User?             @relation("EventCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  dates       EventDate[]
  eventTypes  AssignEventType[]
  locations   EventLocation[]
  createdAt   DateTime          @default(now()) @map("created_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")
  @@map("events")
}

model EventDate {
  id        String   @id @default(uuid())
  eventId   String   @map("event_id")
  date      DateTime
  startTime String?  @map("start_time")  // "HH:mm" 24h, varchar (bukan TIME)
  endTime   String?  @map("end_time")    // "HH:mm" 24h, varchar (bukan TIME)
  @@map("event_dates")
}

model EventType {
  id   String @id @default(uuid())
  name String
  @@map("event_types")
}

model AssignEventType {
  id          String    @id @default(uuid())
  eventId     String    @map("event_id")
  eventTypeId String    @map("event_type_id")
  @@unique([eventId, eventTypeId])
  @@map("assign_event_types")
}

model EventLocation {
  id      String   @id @default(uuid())
  eventId String   @map("event_id")
  name    String
  address String?
  lat     Decimal? @db.Decimal(10, 7)
  lng     Decimal? @db.Decimal(10, 7)
  @@map("event_locations")
}
```

- `slug` unik → `P2002` dipetakan `ConflictException` (409).
- `start_time`/`end_time` sengaja `String?` (varchar) berisi `"HH:mm"` 24h — **bukan** `TIME`/`@db.Time`, menghindari isu serialisasi timezone. Nullable (tanggal bisa tanpa jam).
- Relasi anak `EventDate`/`AssignEventType`/`EventLocation` `onDelete: Cascade`.
- `event_locations.name` **wajib** (satu event = satu lokasi secara logis).
- `visibility` enum `ContentVisibility` (`PUBLIC`/`PRIVATE`), default `PUBLIC`. Migration `20260920130000_add_content_visibility`.

---

## 3. Entity Payload

```typescript
// libs/src/modules/event/entities/event.entity.ts
export const eventSelect = {
  /* kolom scalar + creator + */
  creator: {
    select: {
      id: true,
      fullName: true,
      organizationId: true, // internal (row-level scoping); tidak keluar ke FE
      organization: { select: { id: true, name: true } }, // name keluar ke FE
    },
  },
  dates: { select: { date: true, startTime: true, endTime: true }, orderBy: { date: 'asc' } },
  eventTypes: { select: { eventType: { select: { id: true, name: true } } } },
  locations: { select: { name: true, address: true, lat: true, lng: true } },
} satisfies Prisma.EventSelect;

export type EventDateEntity = { date: string; startTime: string | null; endTime: string | null };

export type EventEntity = Omit<EventRow, 'dates' | 'eventTypes' | 'locations'> & {
  dates: EventDateEntity[];              // date ISO 8601 UTC, startTime/endTime "HH:mm" | null, asc
  eventTypes: { id: string; name: string }[];
  location: { name: string; address: string | null; lat: number | null; lng: number | null } | null;
};

// `creator.organizationId` internal (scope); `creator.organization` ({ id, name } | null) keluar ke FE.
export type EventCreatorRef = {
  id: string;
  fullName: string;
  organization: { id: string; name: string } | null;
};

export type EventResponse = Omit<EventEntity, 'creator'> & {
  creator: EventCreatorRef | null;
};
```

`mapEvent()` mem-flatten join shape: `dates` → `{ date, startTime, endTime }[]` (date ISO, asc), `eventTypes` → `[{ id, name }]`, `locations[0]` → `location` (Decimal → `number`). Join shape tidak pernah bocor ke service/controller.

`EventService.toResponse()` membuang `creator.organizationId` dan memetakan `creator` → `{ id, fullName, organization: { id, name } | null }`. `organizationId` tetap ada pada entity mentah (`EventEntity.creator.organizationId`) untuk `assertReadable`/`assertWritable`/`scopeWhere` (row-level scoping), tetapi **tidak pernah** masuk response. Bila `organization` null, FE memakai `fullName`.


---

## 4. DTO

### `CreateEventDto`

| Field | Aturan |
| --- | --- |
| `name` | trim, `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)` |
| `slug` | opsional, trim, `@MaxLength(200)`, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `content` | opsional, `@IsString()` (default `''`) |
| `thumbnail` | opsional, `@IsString()`, `@MaxLength(2048)` |
| `status` | opsional, `@IsEnum(ContentStatus)` |
| `visibility` | opsional, `@IsEnum(ContentVisibility)`; default `PUBLIC`. Bisa diubah scope `all` & `organization` |
| `publishedAt` | opsional, `@IsISO8601()`; bila ada → paksa `status=PUBLISHED` |
| `eventTypeIds` | opsional, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(50)` |
| `dates` | opsional, `@IsArray()`, `@ValidateNested({ each: true })` + `@Type(() => EventDateDto)`, `@ArrayMaxSize(100)`; array kosong `[]` valid → clear/replace-all relasi `event_dates` |
| `location` | **wajib**, nested `EventLocationDto` (`@ValidateNested` + `@Type`) |

`EventLocationDto`: `name` trim wajib `@MaxLength(200)`; `address` opsional `@MaxLength(500)`; `lat`/`lng` opsional `@IsNumber()` + `@IsLatitude()`/`@IsLongitude()`.

`EventDateDto` (nested di `dates`): `date` wajib `@IsISO8601()`; `startTime`/`endTime` opsional `@Matches(/^([01]\d|2[0-3]):[0-5]\d$/)` → `"HH:mm"` 24h.

### Contoh payload `dates`

```json
{
  "dates": [
    { "date": "2026-10-01T00:00:00.000Z", "startTime": "19:30", "endTime": "22:00" },
    { "date": "2026-10-02T00:00:00.000Z" }
  ]
}
```

### Contoh response `dates`

```json
{
  "dates": [
    { "date": "2026-10-01T00:00:00.000Z", "startTime": "19:30", "endTime": "22:00" },
    { "date": "2026-10-02T00:00:00.000Z", "startTime": null, "endTime": null }
  ]
}
```

### `UpdateEventDto`

```typescript
export class UpdateEventDto extends PartialType(OmitType(CreateEventDto, ['thumbnail'] as const)) {
  @IsOptional() @IsString() @MaxLength(2048)
  thumbnail?: string | null; // undefined = jangan sentuh; null = hapus
}
```

### Contoh 422

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "location.name", "message": "location.name should not be empty" }]
}
```

---

## 5. Strategi Update Relasi

**Replace-all transactional** (hanya bila field dikirim — `undefined` = jangan sentuh):

1. `assign_event_types` → `deleteMany` lalu `createMany` dari `eventTypeIds`.
2. `event_dates` → `deleteMany` lalu `createMany` dari `dates` (`date`, `startTime`, `endTime`).
3. `event_locations` → `deleteMany` lalu `create` dari `location`.

`ponytail:` cukup replace-all; optimalkan diff per-child kalau volume besar.

---

## 6. Kontrak List (RULES bab 19/19a/19b)

### `GET /api/v1/events`

| Item | Nilai |
| --- | --- |
| `EVENT_SEARCHABLE_FIELDS` | `['name', 'slug']` |
| `EVENT_SORT_FIELDS` | `['name', 'slug', 'status', 'visibility', 'publishedAt', 'createdAt', 'updatedAt']` |
| `EVENT_FILTER_FIELDS` | `['status', 'publishedAt', 'createdAt', 'updatedAt']` |
| `EVENT_DATE_FIELDS` | `['publishedAt', 'createdAt', 'updatedAt']` |

**Filter bulan kalender (`eventMonth`)** — opsional, format `YYYY-MM` (contoh `2026-09`). Bila ada, hanya event dengan **minimal satu** `EventDate.date` di bulan tsb yang dikembalikan:

```typescript
// EventService.monthWhere — batas UTC (tanggal tersimpan = UTC midnight)
dates: { some: { date: { gte: Date.UTC(Y, M-1, 1), lt: Date.UTC(Y, M, 1) } } }
```

- Di-AND dengan `scopeWhere`, `filter`, dan `search` yang ada — **tidak** mengubah admin scoping.
- Format invalid → **422** (`Matches(/^\d{4}-(0[1-9]|1[0-2])$/`). Absen → perilaku list lama.

**Filter "My Event" (`mine`)** — opsional, string `true`/`false` (query param). `mine=true` menyaring section "My Event" non-admin:

```typescript
// EventService.mineWhere — selalu di-AND dengan scopeWhere (scope tidak diganti)
scope.kind === 'organization'
  ? { creator: { organizationId: scope.organizationId } } // (a) satu organisasi
  : { createdBy: userId }; // (b) tanpa organisasi → hanya buatan sendiri
```

- Menggantikan perilaku scope `own` (`ownReadWhere`, M5) yang memunculkan konten PUBLISHED milik orang lain; `mine=true` hanya event user sendiri (atau satu organisasi bila ber-`organizationId`).
- Komposisi penuh: `scopeWhere ∧ filter ∧ eventMonth ∧ upcoming ∧ mine ∧ search`. Nilai selain `true`/`false` → **422**.

**Filter "Upcoming" (`upcoming`)** — opsional, string `true`/`false` (query param). `upcoming=true` menyaring event yang punya **minimal satu** `EventDate.date` pada hari ini atau setelahnya (UTC, batas = awal hari UTC sekarang):

```typescript
// EventService.upcomingWhere — selalu di-AND dengan scopeWhere
const now = new Date();
const startOfUtcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
{ dates: { some: { date: { gte: startOfUtcDay } } } }
```

- Cocok untuk section dashboard "Event Mendatang". Absen → perilaku list lama; `true` → hanya event dengan tanggal hari ini/ke depan; `false` → list lama; nilai lain → **422**.


### `GET /api/v1/event-types`

| Item | Nilai |
| --- | --- |
| `EVENT_TYPE_SEARCHABLE_FIELDS` | `['name']` |
| `EVENT_TYPE_SORT_FIELDS` | `['name', 'createdAt', 'updatedAt']` |
| `EVENT_TYPE_FILTER_FIELDS` | `['name', 'createdAt', 'updatedAt']` |
| `EVENT_TYPE_DATE_FIELDS` | `['createdAt', 'updatedAt']` |

Respons list `{ data, meta: { page, limit, total }, message }`.

### Contoh query

- `GET /api/v1/events?page=1&limit=20&sortBy=publishedAt&sortOrder=desc&filter[status]=PUBLISHED`
- `GET /api/v1/events?search=gamelan&sortBy=name&sortOrder=asc`
- `GET /api/v1/events?sortBy=visibility&sortOrder=asc` (server-side sort field `visibility`)
- `GET /api/v1/events?filter[createdAt][gte]=2026-09-01T00:00:00Z`
- `GET /api/v1/events?eventMonth=2026-09&sortBy=name&sortOrder=asc` (events yang punya tanggal di September 2026; navigasi prev/next bulan lewat FE)
- `GET /api/v1/events?mine=true&eventMonth=2026-09` (section "My Event": organisasi/user sendiri + filter bulan)
- `GET /api/v1/events?filter[status]=PUBLISHED&upcoming=true` (dashboard: event terbit dengan >=1 tanggal di masa depan; AND dengan scope)
- `GET /api/v1/event-types?search=workshop&sortBy=name&sortOrder=asc&limit=100`

---

## 7. Tabel Endpoint & Permission

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta, message }`; error `{ statusCode, message, errors }`.

| Method | Path | Akses | Request | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/events` | PERMISSION `event:create` | `CreateEventDto` | 201 `{ data, message }` |
| GET | `/api/v1/events` | PERMISSION `event:read` | `ListEventsQueryDto` | 200 `{ data, meta, message }` |
| GET | `/api/v1/events/:id` | PERMISSION `event:read` | `id` UUID | 200 `{ data, message }` |
| PATCH | `/api/v1/events/:id` | PERMISSION `event:update` | `UpdateEventDto` | 200 `{ data, message }` |
| DELETE | `/api/v1/events/:id` | PERMISSION `event:delete` | `id` UUID | 200 `{ data, message }` |
| POST | `/api/v1/events/:id/submit` | PERMISSION `event:submit` | `id` UUID (tanpa body) | 200 `{ data, message }` |
| POST | `/api/v1/events/:id/approve` | PERMISSION `event:approve` | `id` UUID + body opsional `{ publishedAt? }` | 200 `{ data, message }` |
| POST | `/api/v1/events/:id/reject` | PERMISSION `event:reject` | `id` UUID (tanpa body) | 200 `{ data, message }` |
| POST | `/api/v1/events/:id/publish` | PERMISSION `event:publish` | `id` UUID + body opsional `{ publishedAt? }` | 200 `{ data, message }` |
| POST | `/api/v1/events/:id/unpublish` | PERMISSION `event:unpublish` | `id` UUID (tanpa body) | 200 `{ data, message }` |
| POST | `/api/v1/event-types` | PERMISSION `event-type:create` | `CreateEventTypeDto` (idempoten) | 201 `{ data, message }` |
| GET | `/api/v1/event-types` | PERMISSION `event-type:read` | `ListQueryDto` | 200 `{ data, meta, message }` |
| POST | `/api/v1/images` | PERMISSION `story:create`/`story:update`/`event:create`/`event:update` (ANY-of) | multipart `file`, `entityType=event` | 201 `{ data, message }` |

Permission di-seed di `libs/prisma/seed.ts` (`DEFAULT_PERMISSIONS`); role `admin` otomatis mendapat semuanya.

### Permission action (transisi status) — DI-ENFORCE

`Event` punya `ContentStatus` (`DRAFT`/`REQUEST`/`APPROVED`/`PUBLISHED`) + `publishedAt`/`approvedAt` (mirror `Post`). 5 permission action status di-enforce oleh endpoint `POST /events/:id/<action>` (paritas story, lihat [story.md §6 Action & Transisi](./story.md#action--transisi)). Sumber tunggal aturan: `EVENT_TRANSITIONS` di `event.service.ts`.

| Action | Endpoint | Permission | Dari | Ke |
| --- | --- | --- | --- | --- |
| `submit` | `POST /events/:id/submit` | `event:submit` | `DRAFT` | `REQUEST` |
| `approve` | `POST /events/:id/approve` | `event:approve` | `REQUEST` | `PUBLISHED` |
| `reject` | `POST /events/:id/reject` | `event:reject` | `REQUEST` | `DRAFT` |
| `publish` | `POST /events/:id/publish` | `event:publish` | `APPROVED` | `PUBLISHED` |
| `unpublish` | `POST /events/:id/unpublish` | `event:unpublish` | `PUBLISHED` | `DRAFT` |

- **`approve` langsung menerbitkan** (`REQUEST → PUBLISHED`) dengan `publishedAt` yang dipilih. Status `APPROVED` **deprecated** — tidak lagi diproduksi oleh transisi mana pun (enum Prisma tetap ada untuk kompatibilitas DB/legacy).
- `approvedAt` = **audit marker "pertama kali terbit"** (server-managed): di-set `existing.approvedAt ?? now` saat transisi `approve`/`publish`, atau saat `create`/`update` menghasilkan `PUBLISHED`. **Bukan** penanda status `APPROVED`.
- `approve` & `publish` menerima **body opsional** `PublishContentDto` `{ publishedAt?: string }` (`@IsOptional() @IsISO8601()`): bila dikirim → `publishedAt = new Date(publishedAt)`; bila tidak → `publishedAt` existing, else `now`. `publish` tetap ada untuk kompatibilitas (APPROVED→PUBLISHED; baris APPROVED lama).
- `submit`/`reject`/`unpublish` **tetap tanpa body**, hanya path `id` UUID (`ParseUUIDPipe` → 422 bila invalid). Response `200 { data: <event>, message }`.
- Status saat ini tidak cocok dengan `from` → **409** `ConflictException` pesan `Cannot <action> event in status <STATUS>`. Race dua request paralel dijaga `EventRepository.updateStatusIf` (conditional `updateMany`).
- `unpublish`/`reject` **menyisakan** `publishedAt` (disengaja, konsisten `PATCH`).
- ⚠️ **Bypass workflow ditutup untuk non-admin.** Hanya scope `all` (moderator; mis. permission `event:publish`/`event:approve`) yang masih bisa memaksa `status`/`publishedAt` lewat body `PATCH`/`POST`; scope `organization`/`own` dipaksa `DRAFT` saat create dan `status`/`publishedAt`-nya diabaikan saat update — **kecuali** pemilik/org boleh mengirim `status: DRAFT` untuk menarik event-nya sendiri yang `PUBLISHED` kembali ke `DRAFT` ([Scoping Baca & Tulis](#scoping-baca--tulis)). Role `organization` & `member` (seed baru) hanya punya `event:create/update/submit` (transisi sampai `REQUEST`). **Follow-up:** hapus `status`/`publishedAt` dari DTO setelah FE migrasi.

### Scoping Baca & Tulis

Row-level scoping (`AccessScopeService.resolve(userId, 'event')`, per-resource; lihat [rbac.md §10](./rbac.md#10-row-level-scoping)) membatasi baris `Event`:

| Scope (`kind`) | `canViewPrivate` | Baca | Tulis |
| --- | --- | --- | --- |
| `all` (status-manager: `<event>:approve\|publish\|reject\|unpublish`) | ya | Semua status + PRIVATE. | Bebas. |
| `organization` | ya | Hanya `creator.organizationId === scope.organizationId` (termasuk PRIVATE). | create diizinkan; update/remove/transition hanya konten org-nya. |
| `own` | ya | Miliknya (`createdBy === scope.userId`) **atau** konten terbit (M5). | create diizinkan; update/remove/transition hanya konten miliknya. |
| `published` (punya tulis/status event) | ya | Hanya **sudah terbit**: `status = PUBLISHED` **dan** `publishedAt != null` **dan** `publishedAt <= now` (PRIVATE boleh). Scheduled future belum terlihat. | **403**. |
| `published` (tanpa tulis) | tidak | Sama di atas **dan** `visibility = PUBLIC`. | **403**. |
| `none` | tidak | **List kosong**; `findOne` **403**. | **403**. |

- Scope ditentukan dari **permission per-resource** (`role.permissions[].code`) + `organizationId` — **bukan** nama/`role.code` (lihat [rbac.md §10](./rbac.md#10-row-level-scoping)). `all` = salah satu `event:approve/publish/reject/unpublish`; `organization` = `organizationId` + `event:create/update/submit`; `own` = tulis event tanpa `organizationId`. **`story:*` tidak memberi scope event** (M2).
- `canViewPrivate` = punya permission **tulis** (`event:create/update/submit`) atau **status** (`event:approve/publish/reject/unpublish`) pada event/story — **bukan** sekadar `*:read` (H1). `admin`/`organization`/`member` lama punya tulis konten → tetap boleh baca PRIVATE.
- **List** (`GET /events`): `organization` → `{ creator: { organizationId } }`, `own` → `OR: [{ createdBy: userId }, <published-visible>]` (M5), `published` → `{ status: PUBLISHED, publishedAt: { not: null, lte: now } }`; bila `!canViewPrivate` **AND** `visibility: PUBLIC`; `none` → `{ items: [], total: 0 }`.
- **Detail**: row `visibility === PRIVATE` dan user `!canViewPrivate` → **403**; `organization` beda org → **403**; `own` bukan creator **dan** baris belum terbit → **403** (M5); `published` dengan `status != PUBLISHED`, `publishedAt` null, atau `publishedAt` di masa depan → **403**; `none` → **403**.
- **Tulis**: `organization`/`own` bukan pemilik → **403** `ForbiddenException('Forbidden resource')`; `none`/`published` → **403**.
- **Bypass ditutup**: scope `!= all` → create paksa `DRAFT` (buang `publishedAt`); update/transition mengabaikan `status`/`publishedAt` — **kecuali** `status: DRAFT` pada event miliknya yang `PUBLISHED` (tarik ke `DRAFT`, `publishedAt`/`approvedAt` dipertahankan; nilai `status` lain & `publishedAt` tetap diabaikan). Field `visibility` **bukan** admin-only: scope `all` & `organization` boleh mengubahnya.

```json
{ "statusCode": 403, "message": "Forbidden resource", "errors": [] }
```

---

## 8. Error / Exception

| Endpoint | Exception | Status | Penyebab |
| --- | --- | --- | --- |
| `POST/PATCH /events` | `ConflictException` | 409 | `slug` duplikat (P2002) |
| `POST /events/:id/<action>` | `ConflictException` | 409 | transisi tidak valid dari status saat ini (`Cannot <action> event in status <STATUS>`) |
| `GET/PATCH/DELETE /events/:id` | `NotFoundException` | 404 | event tidak ditemukan |
| create/update | `UnprocessableEntityException` | 422 | validasi DTO |
| `GET /events`, `GET /event-types` | `UnprocessableEntityException` | 422 | `sortBy`/`filter` tak dikenal, enum/tanggal invalid |
| `GET/PATCH/DELETE /events/:id`, action | `ForbiddenException` | 403 | baris di luar scope (organisasi lain / non-PUBLISHED) atau permission kurang |
| semua | `UnauthorizedException` / `ForbiddenException` | 401 / 403 | JWT invalid / permission kurang |
