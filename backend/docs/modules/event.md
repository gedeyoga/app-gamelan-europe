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
  entry       EventEntry        @default(FREE)
  createdBy   String?           @map("created_by")
  creator     User?             @relation("EventCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  networkId   String?
  network     Network?          @relation(fields: [networkId], references: [id], onDelete: SetNull)
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
  id        String   @id @default(uuid())
  eventId   String   @map("event_id")
  name      String
  address   String?
  lat       Decimal? @db.Decimal(10, 7)
  lng       Decimal? @db.Decimal(10, 7)
  countryId Int?     @map("country_id")
  stateId   Int?     @map("state_id")
  cityId    Int?     @map("city_id")
  @@map("event_locations")
}

enum EventEntry {
  FREE
  TICKET
}
```

- `slug` unik → `P2002` dipetakan `ConflictException` (409).
- `start_time`/`end_time` sengaja `String?` (varchar) berisi `"HH:mm"` 24h — **bukan** `TIME`/`@db.Time`, menghindari isu serialisasi timezone. Nullable (tanggal bisa tanpa jam).
- Relasi anak `EventDate`/`AssignEventType`/`EventLocation` `onDelete: Cascade`.
- `event_locations.name` **wajib** (satu event = satu lokasi secara logis).
- `visibility` enum `ContentVisibility` (`PUBLIC`/`PRIVATE`), default `PUBLIC`. Migration `20260920130000_add_content_visibility`.
- `networkId` **opsional/nullable** → `Event.network` adalah organisasi penyelenggara event (hasil approve submission publik via `NetworkService.findOrCreateByName`, atau di-set admin internal). Relasi `onDelete: SetNull` → hapus `Network` tidak menghapus event, hanya melepas relasi. Back-relation: `Network.events Event[]` (network.md §2). **Migration baru** (mis. `add_event_network`) wajib; belum ada saat catatan ini ditulis = RENCANA bila belum diimplementasi.

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
      networkId: true, // internal (row-level scoping); tidak keluar ke FE
      network: { select: { id: true, name: true } }, // name keluar ke FE
    },
  },
  dates: { select: { date: true, startTime: true, endTime: true }, orderBy: { date: 'asc' } },
  eventTypes: { select: { eventType: { select: { id: true, name: true } } } },
  locations: {
    select: {
      name: true, address: true, lat: true, lng: true,
      countryId: true, stateId: true, cityId: true,
      country: { select: { id: true, name: true, iso2: true } },
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
    },
  },
  network: { select: { id: true, name: true } }, // network event (approve submission / di-set admin); keluar ke FE
} satisfies Prisma.EventSelect;

export type EventDateEntity = { date: string; startTime: string | null; endTime: string | null };

export type EventEntity = Omit<EventRow, 'dates' | 'eventTypes' | 'locations'> & {
  dates: EventDateEntity[];              // date ISO 8601 UTC, startTime/endTime "HH:mm" | null, asc
  eventTypes: { id: string; name: string }[];
  location: {
    name: string; address: string | null; lat: number | null; lng: number | null;
    countryId: number | null; stateId: number | null; cityId: number | null;
    country: { id: number; name: string; iso2: string } | null;
    state: { id: number; name: string } | null;
    city: { id: number; name: string } | null;
  } | null;
  network: { id: string; name: string } | null;
};

// `creator.networkId` internal (scope); `creator.network` ({ id, name } | null) keluar ke FE.
export type EventCreatorRef = {
  id: string;
  fullName: string;
  network: { id: string; name: string } | null;
};

export type EventResponse = Omit<EventEntity, 'creator'> & {
  creator: EventCreatorRef | null;
};
```

`mapEvent()` mem-flatten join shape: `dates` → `{ date, startTime, endTime }[]` (date ISO, asc), `eventTypes` → `[{ id, name }]`, `locations[0]` → `location` (Decimal → `number`, + scalar `countryId`/`stateId`/`cityId` dan relasi `country`/`state`/`city` atau `null`), `network` → `{ id, name } | null`. Join shape tidak pernah bocor ke service/controller.

`EventService.toResponse()` membuang `creator.networkId` dan memetakan `creator` → `{ id, fullName, network: { id, name } | null }`. `networkId` **milik creator** tetap ada pada entity mentah (`EventEntity.creator.networkId`) untuk `assertReadable`/`assertWritable`/`scopeWhere` (row-level scoping), tetapi **tidak pernah** masuk response. Scalar `Event.networkId` (top-level, milik event) **tetap** dikirim — bukan data sensitif; FE utamanya memakai `Event.network`. `Event.network` diisi dari approve submission publik atau admin internal (§7).

**Precedence tampilan organisasi (kontrak FE).** Backend menyediakan datanya; FE merender:

```ts
event.network?.name            // 1. org event (approve submission publik / di-set admin)
  ?? event.creator?.network?.name  // 2. org milik user pembuat (fallback, perilaku lama)
  ?? event.creator?.fullName            // 3. nama user pembuat
  ?? '—';
```

`Event.network` = sumber utama (organisasi penyelenggara). `creator.network` **tetap dipertahankan** sebagai fallback agar event internal lama (tanpa `Event.network`) tidak regresi. Bila keduanya null → tampil `creator.fullName`.


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
| `visibility` | opsional, `@IsEnum(ContentVisibility)`; default `PUBLIC`. Bisa diubah scope `all` & `network` |
| `entry` | opsional, `@IsEnum(EventEntry)` (`FREE`/`TICKET`); default `FREE` saat create |
| `publishedAt` | opsional, `@IsISO8601()`; bila ada → paksa `status=PUBLISHED` |
| `eventTypeIds` | opsional, `@IsUUID('4', { each: true })`, `@ArrayMaxSize(50)` |
| `dates` | opsional, `@IsArray()`, `@ValidateNested({ each: true })` + `@Type(() => EventDateDto)`, `@ArrayMaxSize(100)`; array kosong `[]` valid → clear/replace-all relasi `event_dates` |
| `networkId` | opsional, `@IsOptional() @IsUUID('4')`; service cek existence `Network` → tidak ada = **422** per-field (`networkId`). Tidak dikirim → `null` (perilaku lama; tampilan fallback `creator.network`/`fullName`). Tidak auto-derive dari `creator` (eksplisit & minimal). |
| `location` | **wajib**, nested `EventLocationDto` (`@ValidateNested` + `@Type`) |

`EventLocationDto`: `name` trim wajib `@MaxLength(200)`; `address` opsional `@MaxLength(500)`; `lat`/`lng` opsional `@IsNumber()` + `@IsLatitude()`/`@IsLongitude()`; `countryId`/`stateId`/`cityId` opsional `@Type(() => Number) @IsInt()` (chain geo — divalidasi service, lihat §9). `name` **tetap** label lokasi bebas; **tidak ada** kolom venue.

`EventDateDto` (nested di `dates`): `date` wajib `@IsISO8601()`; `startTime`/`endTime` opsional `@Matches(/^([01]\d|2[0-3]):[0-5]\d$/)` → `"HH:mm"` 24h.

### `CreatePublicEventDto` — tanggal & jam (submission publik)

`startDate`/`endDate` menerima `@IsISO8601()` sehingga bentuk `YYYY-MM-DD` **maupun** `YYYY-MM-DDTHH:mm` (24h) valid. `toUtcDate()` tetap menormalkan tiap hari ke UTC midnight untuk enumerasi; komponen jam (bila ada) diambil `toTime()` dan **diterapkan identik ke setiap hari** hasil enumerasi:

- jam pada `startDate` → `EventDate.startTime` untuk **semua** hari;
- jam pada `endDate` → `EventDate.endTime` untuk **semua** hari;
- event multi-hari berbagi window jam yang sama; field hanya `undefined` bila jam tak dikirim.

Aturan validasi (`rangeError`, dipakai `@IsEventDateRange` → 422 `endDate`): `endDate >= startDate`, rentang inklusif ≤ 31 hari, dan bila `startDate` **dan** `endDate` sama-sama membawa komponen jam (`/[T ]\d{2}:\d{2}/`) maka `endTime >= startTime` (pesan `endDate time must not be before startDate time`) — tanpa ini setiap hari akan berakhir sebelum mulai.

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

`networkId` ikut menjadi opsional lewat `PartialType` (kirim `null` untuk melepas relasi; kirim UUID untuk pindah org). Service tetap cek existence → **422** bila UUID tidak ada. Skema perlu migration baru `add_event_network` sebelum kolom ini ada (RENCANA bila belum diimplementasi).

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
scope.kind === 'network'
  ? { creator: { networkId: scope.networkId } } // (a) satu organisasi
  : { createdBy: userId }; // (b) tanpa organisasi → hanya buatan sendiri
```

- Menggantikan perilaku scope `own` (`ownReadWhere`, M5) yang memunculkan konten PUBLISHED milik orang lain; `mine=true` hanya event user sendiri (atau satu organisasi bila ber-`networkId`).
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

> **Perubahan skema (RENCANA bila belum diimplementasi):** `Event.networkId` (nullable) + relasi `Event.network` + back-relation `Network.events Event[]` (network.md §2) → migration baru `add_event_network`. Diisi dari approve submission publik (`NetworkService.findOrCreateByName`) atau admin internal via DTO `networkId` (§4). Tidak ada permission baru untuk field ini.

### Permission action (transisi status) — DI-ENFORCE

`Event` punya `ContentStatus` (`DRAFT`/`REQUEST`/`APPROVED`/`PUBLISHED`) + `publishedAt`/`approvedAt` (mirror `Post`). 5 permission action status di-enforce oleh endpoint `POST /events/:id/<action>` (paritas story, lihat [story.md §6 Action & Transisi](./story.md#action--transisi)). Sumber tunggal aturan: `EVENT_TRANSITIONS` di `event.service.ts`.

| Action | Endpoint | Permission | Dari | Ke |
| --- | --- | --- | --- | --- |
| `submit` | `POST /events/:id/submit` | `event:submit` | `DRAFT` | `REQUEST` |
| `approve` | `POST /events/:id/approve` | `event:approve` | `REQUEST` | `PUBLISHED` |
| `reject` | `POST /events/:id/reject` | `event:reject` | `REQUEST` | `DRAFT` |
| `publish` | `POST /events/:id/publish` | `event:publish` | `DRAFT` **atau** `APPROVED` (legacy) | `PUBLISHED` |
| `unpublish` | `POST /events/:id/unpublish` | `event:unpublish` | `PUBLISHED` | `DRAFT` |

- **`approve` langsung menerbitkan** (`REQUEST → PUBLISHED`) dengan `publishedAt` yang dipilih. Status `APPROVED` **deprecated** — tidak lagi diproduksi oleh transisi mana pun (enum Prisma tetap ada untuk kompatibilitas DB/legacy).
- `approvedAt` = **audit marker "pertama kali terbit"** (server-managed): di-set `existing.approvedAt ?? now` saat transisi `approve`/`publish`, atau saat `create`/`update` menghasilkan `PUBLISHED`. **Bukan** penanda status `APPROVED`.
- `approve` & `publish` menerima **body opsional** `PublishContentDto` `{ publishedAt?: string }` (`@IsOptional() @IsISO8601()`): bila dikirim → `publishedAt = new Date(publishedAt)`; bila tidak → `publishedAt` existing, else `now`. `publish` menerima `DRAFT → PUBLISHED` (jalur utama) **dan** `APPROVED → PUBLISHED` (legacy; baris `APPROVED` lama tetap jalan). Bentuk `EVENT_TRANSITIONS` disesuaikan: `from` menjadi array — `publish: { from: [DRAFT, APPROVED], to: PUBLISHED }`. **RENCANA** — perubahan `EVENT_TRANSITIONS` ini belum ada di kode; kode saat ini masih `from: APPROVED`.
- `submit`/`reject`/`unpublish` **tetap tanpa body**, hanya path `id` UUID (`ParseUUIDPipe` → 422 bila invalid). Response `200 { data: <event>, message }`.
- Status saat ini tidak cocok dengan `from` → **409** `ConflictException` pesan `Cannot <action> event in status <STATUS>`. Race dua request paralel dijaga `EventRepository.updateStatusIf` (conditional `updateMany`).
- `unpublish`/`reject` **menyisakan** `publishedAt` (disengaja, konsisten `PATCH`).
- ⚠️ **Bypass workflow ditutup untuk non-admin.** Hanya scope `all` (moderator; mis. permission `event:publish`/`event:approve`) yang masih bisa memaksa `status`/`publishedAt` lewat body `PATCH`/`POST`; scope `network`/`own` dipaksa `DRAFT` saat create dan `status`/`publishedAt`-nya diabaikan saat update — **kecuali** pemilik/org boleh mengirim `status: DRAFT` untuk menarik event-nya sendiri yang `PUBLISHED` kembali ke `DRAFT` ([Scoping Baca & Tulis](#scoping-baca--tulis)). Role bawaan `member`/`author` (seed baru) hanya punya `event:create/update/submit` (transisi sampai `REQUEST`). **Follow-up:** hapus `status`/`publishedAt` dari DTO setelah FE migrasi.
### Scoping Baca & Tulis

Row-level scoping (`AccessScopeService.resolve(userId, 'event')`, per-resource; lihat [rbac.md §10](./rbac.md#10-row-level-scoping)) membatasi baris `Event`:

| Scope (`kind`) | `canViewPrivate` | Baca | Tulis |
| --- | --- | --- | --- |
| `all` (status-manager: `<event>:approve\|publish\|reject\|unpublish`) | ya | Semua status + PRIVATE. | Bebas. |
| `network` | ya | Hanya `creator.networkId === scope.networkId` (termasuk PRIVATE). | create diizinkan; update/remove/transition hanya konten org-nya. |
| `own` | ya | Miliknya (`createdBy === scope.userId`) **atau** konten terbit (M5). | create diizinkan; update/remove/transition hanya konten miliknya. |
| `published` (punya tulis/status event) | ya | Hanya **sudah terbit**: `status = PUBLISHED` **dan** `publishedAt != null` **dan** `publishedAt <= now` (PRIVATE boleh). Scheduled future belum terlihat. | **403**. |
| `published` (tanpa tulis) | tidak | Sama di atas **dan** `visibility = PUBLIC`. | **403**. |
| `none` | tidak | **List kosong**; `findOne` **403**. | **403**. |

- Scope ditentukan dari **permission per-resource** (`role.permissions[].code`) + `networkId` — **bukan** nama/`role.code` (lihat [rbac.md §10](./rbac.md#10-row-level-scoping)). `all` = salah satu `event:approve/publish/reject/unpublish`; `network` = `networkId` + `event:create/update/submit`; `own` = tulis event tanpa `networkId`. **`story:*` tidak memberi scope event** (M2).
- `canViewPrivate` = punya permission **tulis** (`event:create/update/submit`) atau **status** (`event:approve/publish/reject/unpublish`) pada event/story — **bukan** sekadar `*:read` (H1). `admin`/`member`/`author` punya tulis konten → tetap boleh baca PRIVATE.
- **List** (`GET /events`): `network` → `{ creator: { networkId } }`, `own` → `OR: [{ createdBy: userId }, <published-visible>]` (M5), `published` → `{ status: PUBLISHED, publishedAt: { not: null, lte: now } }`; bila `!canViewPrivate` **AND** `visibility: PUBLIC`; `none` → `{ items: [], total: 0 }`.
- **Detail**: row `visibility === PRIVATE` dan user `!canViewPrivate` → **403**; `network` beda org → **403**; `own` bukan creator **dan** baris belum terbit → **403** (M5); `published` dengan `status != PUBLISHED`, `publishedAt` null, atau `publishedAt` di masa depan → **403**; `none` → **403**.
- **Tulis**: `network`/`own` bukan pemilik → **403** `ForbiddenException('Forbidden resource')`; `none`/`published` → **403**. **Pengecualian:** `EventService.remove(id, userId, { skipScopeCheck: true })` — dipakai purge cascade hapus user (`DELETE /users/:id?cascadeContent=true`; sudah otorisasi `user:delete` + `admin:access`) — melewati `assertWritable` **hanya** agar purge tidak berhenti separuh jalan. Tanpa opsi, perilaku `remove` identik seperti di atas.
- **Bypass ditutup**: scope `!= all` → create paksa `DRAFT` (buang `publishedAt`); update/transition mengabaikan `status`/`publishedAt` — **kecuali** `status: DRAFT` pada event miliknya yang `PUBLISHED` (tarik ke `DRAFT`, `publishedAt`/`approvedAt` dipertahankan; nilai `status` lain & `publishedAt` tetap diabaikan). Field `visibility` **bukan** admin-only: scope `all` & `network` boleh mengubahnya.

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

---

## 9. Event Details: Relasi Geo & `entry`

Fitur "Event Details": `EventLocation` punya relasi geo seragam **Country > State > City**, dan `Event` punya enum tiket masuk.

### 9.1 Model & Migration

- `enum EventEntry { FREE TICKET }`; `Event.entry EventEntry @default(FREE)`.
- `model City` (reference + inline-create): `id Int @id @default(autoincrement())`, `name`, `countryId` (FK Cascade), `stateId Int?` (FK SetNull), `latitude`/`longitude`, `wikiDataId`, `@@map("cities")`. Endpoint `POST /api/v1/cities` (permission `city:create`) inline-create idempoten dari form event. Lihat [city.md](./city.md).
- `EventLocation` + `countryId Int?`, `stateId Int?`, `cityId Int?` (semua FK `onDelete: SetNull`, @index). Back-relations: `Country.cities`/`Country.eventLocations`, `State.cities`/`State.eventLocations`.
- Migration: `20261006140000_add_event_details_city_entry`, `20261006150000_city_id_autoincrement` (sequence `cities_id_seq` + `setval` `MAX(id)`). Karena `createMany` id eksplisit tidak meng-advance sequence, `seed-geo.ts` meng-`setval` lagi setelah seeding cities (wajib untuk fresh deploy; lihat [city.md](./city.md) §2). **Tidak ada** kolom venue baru — VENUE hanya label UI di frontend; `EventLocation.name` tetap sebagaimana adanya.

### 9.2 Validasi chain geo (422 per-field)

`EventService.assertLocationGeo()` (mirror `UserService.assertStateCountryMatch`) dijalankan saat `create`/`update` bila `location` dikirim:

| Field | Aturan | Pesan 422 |
| --- | --- | --- |
| `location.countryId` | bila ada, wajib `Country` eksis | `countryId does not exist` |
| `location.stateId` | wajib ada `countryId`; `state.countryId === countryId` | `stateId requires countryId` / `stateId must belong to countryId` |
| `location.cityId` | wajib ada `stateId`; `city.stateId === stateId` **dan** `city.countryId === countryId` | `cityId requires stateId` / `cityId must belong to stateId` |

### 9.3 Submission publik

`createPublicSubmission` mengisi `location.countryId` dari `countryId` submission (bila valid); `stateId`/`cityId` **null** (submission hanya mengirim `countryId`/`stateId`, tanpa city). Tidak ada langkah approve-lalu-recreate terpisah: submission menulis `Event` langsung.

### 9.4 Response location

```json
{
  "location": {
    "name": "Bali", "address": "Bali, Indonesia", "lat": null, "lng": null,
    "countryId": 101, "stateId": null, "cityId": null,
    "country": { "id": 101, "name": "Indonesia", "iso2": "ID" },
    "state": null, "city": null
  }
}
```

