# Module: Notification

Menu: [smtp.md](../integrations/smtp.md) · [story.md](./story.md) · [event.md](./event.md) · [archive.md](./archive.md) · [rbac.md](./rbac.md) (master)

> **STATUS: DIIMPLEMENTASIKAN (backend).** Schema + migration, `NotificationModule` (repository/service/queue/template), hook publish di `post`/`event`/`archive`, hook submission admin (`CONTENT_SUBMITTED`, `SUBSCRIPTION_REQUEST_SUBMITTED`), lifecycle membership (`SUBSCRIPTION_ACTIVE`/`SUBSCRIPTION_EXPIRING`/`SUBSCRIPTION_EXPIRED`/`SUBSCRIPTION_CANCELED`), producer `Queue` + `Worker` BullMQ dengan job recovery + job lifecycle, dan endpoint `notifications`/`notification-preferences` sudah ada. Sisa: FE mengirim `notify` + route slug (`/stories/:slug`, `/events/:slug`, `/archives/:slug`).

---

## 1. Tujuan & Scope

Member diberi tahu lewat **email** ketika konten (`Post`/story, `Event`, `Archive`) berubah menjadi terbit (`PUBLISHED` dan `publishedAt <= now`).

| In scope | Keterangan |
| --- | --- |
| Email notifikasi publish | Satu email per konten per user, berisi judul + link konten. |
| Tabel `notifications` | **Sumber kebenaran + outbox**: baris dibuat di transaksi publish, worker mengirim email. |
| Preferensi opt-out | Tabel `NotificationPreference` per `(user, type, channel)`; baris tidak ada = `emailEnabled = true` (default). |
| Flag `notify` | Checkbox "Notify members by email" di dialog publish (FE sudah ada, UI-only) → payload `notify?: boolean`. |
| Endpoint `me` | List notifikasi sendiri, mark-read, read-all. |
| Notifikasi admin submission | Submission publik baru (`Post`/`Event`/`Archive`/`Network`) & subscription request baru → in-app + email ke semua `User.status = ACTIVE` + `role.code = admin` (hormati opt-out `EMAIL` per tipe). |
| Notifikasi lifecycle membership | Email ke **pemilik billing** saat membership aktif (`approve`), 7 hari sebelum berakhir, setelah berakhir (`PAID`, belum dibatalkan), dan saat admin membatalkan billing (`CANCELED`). |
| Worker pengirim | BullMQ `Worker` (Redis `REDIS_URL`) + kirim via `SmtpService`; retry/backoff/delay milik BullMQ. |

**Di luar scope:**

- Push notification, SMS, WhatsApp.
- Digest / batch harian, frekuensi, quiet hours.
- Marketing/newsletter, segmentasi, tracking open/click, bounce/complaint handling.
- Notifikasi in-app realtime (WebSocket/SSE). Tabel ini *bisa* dipakai sebagai sumber list in-app, tetapi belum ada delivery realtime.
- Notifikasi pembayaran lain (approve/reject request, refund), hanya submission baru + lifecycle membership yang masuk scope.
- Multi-bahasa penuh; template awal hardcoded Indonesia + key i18n disiapkan.
- Re-notify saat konten diedit/diterbitkan ulang (lihat §9).

Definisi **member** untuk dokumen ini: user `status = ACTIVE` **dan** `role.code ∈ { member, author }` **dan** `NotificationPreference.emailEnabled = true` untuk `(type = CONTENT_PUBLISHED, channel = EMAIL)` (baris absen = enabled). User tanpa role / role `admin` tidak menerima. Creator konten **dan** author yang tercantum di konten dikecualikan (Q2/Q3). Untuk `Archive.type = MEMBER`, recipient dibatasi ke pemegang membership berbayar aktif (`Billing.status = PAID` dan `expiryDate > now`, mirror `BillingRepository.hasActiveByUser`) — Q4; Post/Event/`Archive.type = PUBLIC` tanpa filter membership.

Definisi **admin recipient** (khusus `CONTENT_SUBMITTED` & `SUBSCRIPTION_REQUEST_SUBMITTED`): user `status = ACTIVE` **dan** `role.code = admin` **dan** tanpa baris `NotificationPreference` `(type, channel = EMAIL)` dengan `emailEnabled = false`. Creator/author tidak dikecualikan; membership tidak dicek.

---

## 2. Keputusan Desain

| # | Keputusan | Alasan | Konsekuensi |
| --- | --- | --- | --- |
| D1 | **Outbox pattern**: row `notifications` ditulis di transaksi publish yang sama; worker mengirim email | Request HTTP publish tidak menunggu SMTP; idempotent; bisa retry; publish tetap jalan saat SMTP down | Worker wajib jalan; job di-`addBulk` **setelah commit** (Redis eksternal, tidak bisa ikut `$transaction` Prisma) |
| D2 | Recipient = `User.status = ACTIVE` + `role.code ∈ {member, author}` + preferensi email enabled (absen = enabled) + **bukan creator** + **bukan author konten**; untuk `Archive.type = MEMBER` wajib membership aktif (`Billing` PAID & belum expiry) | Sesuai requirement "member"; menghormati opt-out; creator/author sudah tahu kontennya; archive member memang audiens berbayar | User tanpa role tidak dapat email; cek membership di transaksi publish (§5.3) |
| D3 | `notify?: boolean` di body `approve`/`publish` **dan** `create`/`update` (auto-publish), **default `true`**; `false` → **tidak membuat row** | FE checkbox sudah ada; tidak perlu kolom di tabel konten | Tidak ada audit "publish tanpa notifikasi" selain absennya row. `CreatePublic*Dto` tidak menerima `notify` (submission = `REQUEST`, tanpa notifikasi) |
| D4 | `NotificationEntityType` = **enum** (`POST`, `EVENT`, `ARCHIVE`), bukan `String` bebas | Hanya 3 jenis; typo/varian string merusak routing email & link; type-safety di service | Menambah jenis konten butuh migration enum (murah) |
| D5 | **Tanpa FK polimorfik**; `entityType + entityId` disimpan apa adanya | Satu kolom tidak bisa FK ke 3 tabel; cukup untuk audit/url | Tidak ada cascade saat konten dihapus; cleanup manual (§9) |
| D6 | Unique `(userId, type, entityType, entityId)` = **sekali per konten per user, selamanya** | Mencegah double email saat double approve/retry/re-publish | Publish ulang setelah unpublish **tidak** mengirim email kedua; lihat §9 |
| D7 | `publishedAt` masa depan → row `PENDING` dengan `scheduledAt = publishedAt`; job di-`addBulk` dengan `delay`, worker hanya memproses saat delay habis | Delay milik BullMQ; tidak perlu scheduler sendiri; preferensi tetap dicek saat kirim | Row "masa depan" menumpuk (kecil); job delayed tersimpan di Redis selama belum due |
| D8 | Preferensi = tabel granular `NotificationPreference` `(userId, type, channel)` sejak migration pertama | Q9: butuh opt-out per tipe/channel tanpa migrasi kolom lagi; row absen = enabled sehingga **tanpa backfill** | Query recipient pakai relasi `none` (§3.4/§5.3); endpoint preferensi khusus (§7) |
| D9 | Worker trigger = **BullMQ** (queue `notifications`) di Redis existing (`REDIS_URL`); producer `Queue` (app), consumer `Worker` (`apps/worker`); retry/backoff/delay/concurrency milik BullMQ | Redis sudah ada; klaim job atomik; multi-instance aman tanpa `SKIP LOCKED`; delayed job native; volume rendah tetap murah | Dependency `bullmq`; satu koneksi Redis tambahan (bukan cache client); butuh worker hidup |
| D10 | Kirim hanya untuk konten yang memang untuk member: `Post`/`Event` `visibility = PUBLIC`; `Archive` semua `type` (`PUBLIC` & `MEMBER`), dengan filter membership tambahan untuk `MEMBER` | PRIVATE bukan konsumsi member umum; `Archive.type = MEMBER` justru ditujukan ke member berbayar | Perubahan visibility/type/membership setelah enqueue tidak dicek ulang (edge §9) |
| D11 | `linkPath` disimpan saat enqueue (snapshot path FE berbasis **slug**), URL penuh dirakit dari env `APP_WEB_URL` saat kirim | Worker tidak perlu join ke 3 tabel / tidak tergantung slug yang bisa berubah; Q7: konsisten slug untuk ketiga domain | `Archive.slug` sudah ada (unique, suffix `-2`, `-3`, retry P2002); route FE `/archives/:slug` tetap prasyarat link; slug berubah setelah enqueue → link lama (edge §9) |
| D12 | **Batas transaksi + recovery**: row di-insert di `$transaction` publish; `queue.addBulk` **setelah commit** dengan `jobId = notification.id`; gagal enqueue → row tetap `PENDING`; job repeatable recovery tiap 5 menit me-re-enqueue row `PENDING` yang belum terkirim | Redis tidak bisa ikut transaksi DB; outbox harus tetap benar bila Redis mati; `jobId` bikin re-enqueue idempotent | Dua sumber kebenaran sementara (DB + Redis); job recovery menambah satu query periodik (bukan poll pengiriman) |

---

## 3. Model Prisma Usulan

### 3.1 Enum & model

```prisma
enum NotificationType {
  CONTENT_PUBLISHED
  CONTENT_SUBMITTED
  SUBSCRIPTION_REQUEST_SUBMITTED
  SUBSCRIPTION_ACTIVE
  SUBSCRIPTION_EXPIRING
  SUBSCRIPTION_EXPIRED
  SUBSCRIPTION_CANCELED
}

enum NotificationEntityType {
  POST
  EVENT
  ARCHIVE
  NETWORK
  SUBSCRIPTION_REQUEST
  SUBSCRIPTION
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  SKIPPED
}

enum NotificationChannel {
  EMAIL
}

model Notification {
  id          String                 @id @default(uuid())
  userId      String                 @map("user_id")
  user        User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        NotificationType
  entityType  NotificationEntityType @map("entity_type")
  entityId    String                 @map("entity_id")
  title       String
  body        String?                @db.Text
  imageUrl    String?                @map("image_url")
  linkPath    String?                @map("link_path")
  status      NotificationStatus     @default(PENDING)
  lastError   String?                @map("last_error")
  scheduledAt DateTime               @default(now()) @map("scheduled_at")
  sentAt      DateTime?              @map("sent_at")
  readAt      DateTime?              @map("read_at")
  createdAt   DateTime               @default(now()) @map("created_at")
  updatedAt   DateTime               @updatedAt @map("updated_at")

  @@unique([userId, type, entityType, entityId])
  @@index([status, scheduledAt])
  @@index([userId, readAt])
  @@map("notifications")
}

model NotificationPreference {
  id           String              @id @default(uuid())
  userId       String              @map("user_id")
  user         User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  type         NotificationType
  channel      NotificationChannel @default(EMAIL)
  emailEnabled Boolean             @map("email_enabled") @default(true)
  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")

  @@unique([userId, type, channel])
  @@map("notification_preferences")
}
```

Tambahan di `model User` (hanya dua baris; jangan menyalin ulang seluruh model):

```prisma
model User {
  // ... field existing tetap
  notifications             Notification[]
  notificationPreferences   NotificationPreference[]
}
```

### 3.2 Catatan field

| Field | Alasan / perilaku |
| --- | --- |
| `userId` + `onDelete: Cascade` | User dihapus → notifikasi ikut hilang (tidak ada PII menggantung). |
| `type` | `CONTENT_PUBLISHED` (member), `CONTENT_SUBMITTED` (admin, submission konten), `SUBSCRIPTION_REQUEST_SUBMITTED` (admin, subscription request), `SUBSCRIPTION_ACTIVE`/`SUBSCRIPTION_EXPIRING`/`SUBSCRIPTION_EXPIRED`/`SUBSCRIPTION_CANCELED` (member, pemilik billing). Dipisah dari `entityType` agar event lain bisa ditambah tanpa mengubah arti `entityType`. |
| `entityType` enum | Lihat D4. Nilai terbatas & valid by construction. |
| `entityId` | UUID konten / `billing.id` (lifecycle). **Bukan FK** (polimorfik). |
| `title` | Judul konten (Post/Event/Archive `name`) — dipakai subject email + list in-app. Lifecycle: nama paket. |
| `body` | `CONTENT_PUBLISHED`: excerpt **plain text** (HTML di-strip, max ±300 char). `CONTENT_SUBMITTED`/`SUBSCRIPTION_REQUEST_SUBMITTED`/lifecycle: detail request sebagai baris `Label: value` dipisah newline (HTML di-strip, nilai kosong dibuang, tiap nilai ≤160 char satu baris). Nullable. |
| `imageUrl` | Thumbnail konten (URL absolut) untuk kartu email. Nullable → kartu dirender tanpa gambar. |
| `linkPath` | Path FE relatif berbasis slug (mis. `/stories/slug`), snapshot saat enqueue. URL penuh = `APP_WEB_URL + linkPath`. |
| `status` | `PENDING` → `SENT`/`FAILED`/`SKIPPED`. Tidak ada `PROCESSING`: BullMQ yang memegang job aktif. |
| `lastError` | Nama error/kode aman **generik** (mis. `BadGatewayException`) — `SmtpService` membungkus error transport, kode asli (`EAUTH`/`ETIMEDOUT`) hanya di log server. **Tanpa** email, kredensial, atau body SMTP. Ditulis `Worker` hanya pada attempt final (event `failed` saat `job.attemptsMade >= job.opts.attempts`); bukan setiap retry (retry count milik BullMQ). |
| `attempts` | **Tidak ada kolom.** BullMQ menyimpan `attemptsMade`/backoff di job; DB tidak perlu cermin. Jangan tambah kecuali butuh audit percobaan independen dari Redis. |
| `scheduledAt` | Default `now()`. Untuk future publish = `publishedAt`; dipakai menghitung `delay` saat `addBulk` dan oleh job recovery untuk menghitung ulang delay. |
| `sentAt` / `readAt` | Audit kirim & status baca in-app. `readAt` hanya diisi endpoint mark-read. |
| `@@unique(...)` | Idempotency enqueue. Lihat D6/§9. |
| `@@index([status, scheduledAt])` | Job recovery: `status=PENDING AND scheduled_at <= now ORDER BY scheduled_at`. |
| `@@index([userId, readAt])` | List "belum dibaca" + badge count. |

### 3.3 Tanpa `channel` di row `Notification`

Row `Notification` selalu email saat ini → tidak perlu kolom `channel`; channel hidup di `NotificationPreference` (Q9). Tambahkan `channel` + index `(channel, status, scheduledAt)` di row notifikasi hanya bila delivery non-email (push/in-app realtime) mulai ditulis ke outbox yang sama.

### 3.4 Preferensi: tabel granular sejak awal

`NotificationPreference` dipakai **dari migration pertama** (Q9), bukan kolom boolean di `User`:

- Granularitas `(type, channel)` sudah tersedia tanpa migration kolom di kemudian hari.
- **Baris absen = enabled** (`emailEnabled` default `true`) → **tidak ada backfill**; user existing langsung menerima sampai opt-out.
- Query recipient tanpa join manual: relasi `none` difilter di `where`, mis. `notificationPreferences: { none: { type: CONTENT_PUBLISHED, channel: EMAIL, emailEnabled: false } }` (relasi `User.notificationPreferences`). Satu query, tanpa `include`.
- Upsert idempotent saat user mengubah preferensi: `(userId, type, channel)` unique.

Tambah kompleksitas (kategori/frekuensi/digest, unsubscribe token publik, audit terpisah) hanya bila produk memintanya; bentuk sekarang sudah menampung per-tipe & per-channel tanpa perubahan skema.

---

## 4. Migration Plan

Folder: `libs/prisma/migrations/20261019120000_add_notifications/migration.sql`.

```sql
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CONTENT_PUBLISHED');

-- CreateEnum
CREATE TYPE "NotificationEntityType" AS ENUM ('POST', 'EVENT', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_type_channel_key"
  ON "notification_preferences"("user_id", "type", "channel");

-- AddForeignKey
ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "entity_type" "NotificationEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link_path" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "last_error" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_type_entity_type_entity_id_key"
  ON "notifications"("user_id", "type", "entity_type", "entity_id");

CREATE INDEX "notifications_status_scheduled_at_idx"
  ON "notifications"("status", "scheduled_at");

CREATE INDEX "notifications_user_id_read_at_idx"
  ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

Catatan:

| Hal | Keterangan |
| --- | --- |
| Additive | Tanpa `DROP`/`ALTER` destruktif; hanya enum & tabel baru. |
| Data lama | **Tidak perlu backfill preferensi**: baris absen = `emailEnabled = true` di query & endpoint. |
| Archive.slug | **Prasyarat terpisah, migration lebih awal** (mis. `20261018090000_add_archive_slug` sebelum `add_notifications`): `ALTER TABLE "archives" ADD COLUMN "slug" TEXT`, backfill `slug` unik dari `name` + suffix (`-2`, `-3`, …), lalu `CREATE UNIQUE INDEX`. Bentuk persis mengikuti pola `posts`/`events`; **harus** ada sebelum enqueue link `/archives/{slug}`. |
| Aman | Tidak menyentuh `posts`/`events`/`archives` (selain migration slug di atas); tidak perlu backfill notifikasi historis. |
| Drift | Jika `prisma migrate dev` menolak karena drift historis (lihat [subscription-request.md §1](./subscription-request.md#migration)), pakai `pnpm prisma:migrate:deploy`. |
| Enum submission | Migration additive `20261019130000_notification_submission_types`: `ALTER TYPE "NotificationType" ADD VALUE 'CONTENT_SUBMITTED'` + `'SUBSCRIPTION_REQUEST_SUBMITTED'`; `NotificationEntityType` + `'NETWORK'`, `'SUBSCRIPTION_REQUEST'`. |
| Thumbnail email | Migration additive `20261019140000_notification_image_url`: `ALTER TABLE "notifications" ADD COLUMN "image_url" TEXT`. Nullable, tanpa backfill. |
| Enum lifecycle | Migration additive `20261020120000_notification_subscription_lifecycle`: `ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_ACTIVE'/'SUBSCRIPTION_EXPIRING'/'SUBSCRIPTION_EXPIRED'` + `NotificationEntityType` + `'SUBSCRIPTION'`. Tanpa perubahan tabel. |
| Enum canceled | Migration additive `20261024120000_notification_subscription_canceled`: `ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_CANCELED'` (satu statement, tanpa perubahan tabel). **Sudah di-`prisma:migrate:deploy` ke DB dev** dan enum terverifikasi berisi nilainya; tanpa itu insert row akan gagal `PrismaClientUnknownRequestError`. |
| Generate | Setelah migration: `pnpm prisma:generate`. Seed **tidak berubah** (tidak ada permission baru). |

---

## 5. Alur Runtime

### 5.1 Enqueue saat publish

Titik hook (existing):

| Domain | File / method | Action pemicu |
| --- | --- | --- |
| Story | `libs/src/modules/post/post.service.ts` → `transition()` | `approve`, `publish` |
| Event | `libs/src/modules/event/event.service.ts` → `transition()` | `approve`, `publish` |
| Archive | `libs/src/modules/archive/archive.service.ts` → `transition()` | `approve`, `publish` |

Selain action endpoint, jalur **auto-publish** juga memicu enqueue:

- `post/event/archive.service.ts` → `create()` bila `dto.publishedAt` dikirim / `status = PUBLISHED`.
- `update()` bila `publishedAt` dikirim atau `status` naik ke `PUBLISHED`.

**Gate scope.** Jalur `update()` hanya menotifikasi untuk `scope.kind === 'all'`: non-admin tidak boleh mengubah `status`/`publishedAt` (diabaikan), jadi tidak boleh memicu email. `create()` non-admin dipaksa `DRAFT` sehingga `notifyPublished` early-return sendiri. `transition()` tetap menotifikasi pada `approve`/`publish` (aksi itu sendiri sudah dijaga permission); `create()`/`update()`/`transition()` konsisten: email hanya saat konten benar-benar terbit.

`unpublish`, `reject`, `submit` **tidak** enqueue notifikasi member. Khusus **Network**, `submit` (member/admin lewat `NetworkService.transition('submit')`, termasuk `bulkUpdateStatus`) mengirim notifikasi **admin** — lihat tabel di bawah.

Submission baru (setelah row konten/request tersimpan) memanggil `NotificationService.notifyAdmins`:

| Domain | File / method | `type` / `entityType` | `linkPath` |
| --- | --- | --- | --- |
| Story | `post.service.ts` → `createPublicSubmission()` | `CONTENT_SUBMITTED` / `POST` | `/dashboard` |
| Event | `event.service.ts` → `createPublicSubmission()` | `CONTENT_SUBMITTED` / `EVENT` | `/dashboard` |
| Archive | `archive.service.ts` → `createPublicSubmission()` | `CONTENT_SUBMITTED` / `ARCHIVE` | `/dashboard` |
| Network | `network.service.ts` → `createPublicSubmission()` | `CONTENT_SUBMITTED` / `NETWORK` | `/dashboard` |
| Network | `network.service.ts` → `transition('submit')` (member/admin + bulk) | `CONTENT_SUBMITTED` / `NETWORK` | `/networks` |
| Subscription | `subscription-request.service.ts` → `createPublic()` + `createMine()` | `SUBSCRIPTION_REQUEST_SUBMITTED` / `SUBSCRIPTION_REQUEST` | `/subscription-requests/{id}` |

> Network `transition('submit')`: dipanggil **setelah** `updateStatusIf` sukses (anti-TOCTOU), sekali per transisi — `bulkUpdateStatus` yang memanggil `transition` per id tidak menambah panggilan kedua. `notifyAdmins` sudah best-effort (try/catch internal → `warn`), jadi tidak dibungkus try/catch lagi dan tidak menggagalkan submit. 409 sebelum update → tanpa notifikasi. `approve`/`reject`/`unpublish` tidak mengirim. `linkPath = '/networks'` (halaman review admin), bukan `/dashboard`.


`notifyAdmins(input)` membuka transaksi, memanggil `repository.findAdminRecipientIds(tx, type)` (`status = ACTIVE`, `role.code = admin`, tanpa preferensi `EMAIL` tipe tersebut yang `emailEnabled = false`), `createMany` row (`scheduledAt = now`), lalu `enqueuePending` setelah commit. Tanpa recipient → tidak ada row/job. Semua error (DB/Redis) hanya `warn` — request submission tetap sukses.

`input.details?: Array<{ label: string; value: string | null | undefined }>` — detail request yang ditampilkan ke admin. `body` dirakit dari `details` bila ada (urutan dipertahankan, nilai kosong dibuang, HTML di-strip, trim, ≤160 char, satu baris, dipisah newline `Label: value`); `details` kosong → fallback excerpt `body` (perilaku lama).

| Domain | `details` |
| --- | --- |
| Subscription | Full name, Email, Phone (skip null), Organisation (skip null), Package, Request type, Reason (skip null) |
| Story | Submitted by, Email, Type = `Story` |
| Archive | Submitted by, Email, Type = `Archive` |
| Event | Submitted by, Email, Type = `Event` |
| Network | Submitted by, Email, Type = `Network` |
| Network (submit member/admin) | Type = `Network`, Email = `submitterEmail` (nullable; `formatDetails` membuang nilai kosong) |

### 5.2 Urutan

```text
POST /posts/:id/approve { publishedAt?, notify? }
  └─ PostService.transition()
       ├─ findById (404) + scope check (403)
       ├─ cek status (409)
       ├─ $transaction:
       │    ├─ updateStatusIf(id, from, to, { publishedAt, approvedAt }, tx)  ← harus menerima `tx`
       │    └─ NotificationService.enqueueContentPublished(tx, {
       │          entityType: 'POST', entityId, title, body, linkPath,
       │          publishedAt, notify: dto.notify !== false, actorId: user.id,
       │          archiveType,   // hanya ARCHIVE; untuk Q4
       │        })
       │         ├─ notify === false → return 0
       │         ├─ query recipients (...)
       │         └─ createMany({ data: rows, skipDuplicates: true })
       ├─ (transaction commit)
       ├─ NotificationQueue.enqueuePending(entityType, entityId)   ← SETELAH commit
       │    ├─ rows = notification.findMany({ entityType, entityId, status: PENDING })
       │    └─ queue.addBulk(rows.map(row => ({
       │          name: 'send', data: { notificationId: row.id },
       │          opts: {
       │            jobId: row.id,
       │            delay: Math.max(0, row.scheduledAt.getTime() - Date.now()),
       │            attempts: 3,
       │            backoff: { type: 'exponential', delay: 60_000 },
       │            removeOnComplete: 1000, removeOnFail: 5000,
       │          },
       │        })))
       └─ findOne(id) → response 200
```

- **Redis di luar transaksi**: `Queue` tidak bisa ikut `$transaction` Prisma. Insert outbox tetap atomik dengan update status; enqueue sesudah commit.
- **Enqueue gagal** (Redis down/timeout): log `warn`, **jangan** gagalkan publish; row tetap `PENDING` → job recovery (§5.5) me-re-enqueue. `jobId = row.id` membuat re-enqueue idempotent selama job lama masih ada.
- **`skipDuplicates`**: panggilan kedua tidak membuat row; `enqueuePending` meng-enqueue ulang row `PENDING` yang ada. Aman karena worker no-op untuk row non-`PENDING`.
- **Query setelah commit** (bukan `createManyAndReturn`) dipakai karena `createMany` tidak mengembalikan id; sekaligus menyapu row `PENDING` dari jalur lain di entity yang sama.
- **Best-effort untuk create/update auto-publish**: bila refactor transaksi terlalu lebar, enqueue setelah persist + `try/catch` + log. Konsekuensi: publish sukses tapi email tidak pernah masuk. `ponytail:` pilih satu; rekomendasi tetap transaksi untuk seluruh jalur publish.
- **`publishedAt` masa depan**: row `PENDING` + `delay` di job; worker baru memproses saat delay habis. Tidak perlu state scheduler; opt-out dicek saat kirim (bukan saat due).

### 5.3 Resolusi recipient (di dalam transaksi)

```ts
// entityType/entityId sudah diketahui; archiveType hanya untuk ARCHIVE.
const now = new Date();
const creatorId = actorId; // user.id pelaku publish
const authorIds =
  entityType === 'POST'
    ? (await tx.postAuthor.findMany({ where: { postId: entityId }, select: { userId: true } })).map((a) => a.userId)
    : entityType === 'EVENT'
      ? (await tx.eventAuthor.findMany({ where: { eventId: entityId }, select: { userId: true } })).map((a) => a.userId)
      : (await tx.archiveAuthor.findMany({ where: { archiveId: entityId }, select: { userId: true } })).map((a) => a.userId);

const recipients = await tx.user.findMany({
  where: {
    status: UserStatus.ACTIVE,
    role: { code: { in: ['member', 'author'] } },
    // Preference: baris absen = enabled → cukup filter baris yang eksplisit false.
    notificationPreferences: {
      none: {
        type: NotificationType.CONTENT_PUBLISHED,
        channel: NotificationChannel.EMAIL,
        emailEnabled: false,
      },
    },
    // Creator + author konten tidak menerima (Q2/Q3).
    id: { notIn: [creatorId, ...authorIds] },
    // Q4: hanya Archive.type = MEMBER yang dibatasi membership berbayar aktif.
    ...(entityType === 'ARCHIVE' && archiveType === 'MEMBER'
      ? { billings: { some: { status: BillingStatus.PAID, expiryDate: { gt: now } } } }
      : {}),
  },
  select: { id: true },
});
```

- User `roleId = null` tidak cocok → tidak dapat email (bukan member).
- `admin` tidak cocok → tidak dapat email.
- Preference: `none` tidak butuh `include`/join manual; user tanpa row tetap lolos (default enabled).
- Membership: query dijalankan **di dalam `$transaction` publish yang sama** (`tx`), jadi snapshot status `Billing` konsisten dengan momen publish. `now` = satu variabel untuk seluruh query.
- Author konten dikecualikan total (bukan hanya dedupe): bila author juga creator, `notIn` menanganinya. Author tetap bisa menerima konten **lain**.
- `actorId` selalu ada pada jalur publish (approve/publish/create/update oleh user login); bila tidak, creator tidak dapat dikecualikan.
- `linkPath` dirakit di service sebelum `createMany`: `POST` → `/stories/${post.slug}`, `EVENT` → `/events/${event.slug}`, `ARCHIVE` → `/archives/${archive.slug}`. Slug wajib sudah tersimpan (Archive: prasyarat §4); bila null, `linkPath = null` + email tanpa link (jangan fallback ke id — Q7).
- Bila produk berubah pikiran: hapus `actorId`/`authorIds` dari `notIn`, atau pindahkan filter membership ke worker (butuh snapshot `archiveType`).

### 5.4 Insert outbox

```ts
const now = new Date();
const scheduledAt = publishedAt && publishedAt > now ? publishedAt : now;

const data = recipients.map((r) => ({
  userId: r.id,
  type: NotificationType.CONTENT_PUBLISHED,
  entityType,
  entityId,
  title,
  body: excerpt ?? null,
  linkPath: linkPath ?? null,
  status: NotificationStatus.PENDING,
  scheduledAt,
}));

const { count } = await tx.notification.createMany({ data, skipDuplicates: true });
```

`skipDuplicates` + unique key = idempotent saat double approve/re-request/retry. Baris yang benar-benar masuk di-enqueue setelah commit (`enqueuePending`, §5.2); `scheduledAt` menjadi `delay` job.

### 5.5 BullMQ worker

**Dependency:** `bullmq` saja (raw). Tanpa `@nestjs/bullmq`: tiga provider kecil lebih murah daripada modul + decorator + forRoot tambahan, dan queue dipakai di dua app (`app` producer, `worker` consumer). Provider dibuat lewat factory.

| Item | Nilai |
| --- | --- |
| Queue | `notifications` (konstanta `NOTIFICATION_QUEUE`) |
| Job name | `send`, payload `{ notificationId }`; `recover`; `subscription-lifecycle` |
| `jobId` | `notification.id` → enqueue ganda tidak membuat job kedua (selama job lama masih ada) |
| Retry | `attempts: 3`, `backoff: { type: 'exponential', delay: 60_000 }` (1m, 2m) |
| Retention | `removeOnComplete: 1000`, `removeOnFail: 5000` (count) |
| Consumer | `apps/worker/src/processors/notification.processor.ts` (`Worker`), query domain tetap di `NotificationRepository` |
| Producer | `NotificationQueue` (`libs/src/modules/notification/notification.queue.ts`) — dipakai `NotificationService` (app) dan job recovery (worker) |
| Concurrency | `NOTIFICATION_WORKER_CONCURRENCY` (default **5**) |

**Koneksi Redis.** BullMQ butuh `maxRetriesPerRequest: null` **hanya** untuk koneksi blocking milik `Worker` consumer. Jangan pakai ulang `REDIS_CLIENT` cache di `libs.module.ts`: client itu `lazyConnect: true` dan dipakai untuk command biasa — koneksi blocking harus dedicated.

Producer (`NotificationModule`, termasuk job recovery di worker) memakai koneksi **bounded** supaya request HTTP / boot worker tidak menggantung saat Redis mati: `maxRetriesPerRequest: 3` + `enableOfflineQueue: false` → command langsung reject (`Stream isn't writeable…`) dan `try/catch` di `NotificationService.enqueuePending`/`publishAfterCommit`/`enqueueRecovery` hanya menulis `warn`.

```ts
// NotificationModule (producer Queue + recovery)
const connection = new IORedis(config.get<string>('REDIS_URL'), {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
});

// apps/worker/src/app.module.ts (Worker consumer)
const connection = new IORedis(config.get<string>('REDIS_URL'), {
  maxRetriesPerRequest: null,
});
```

`Queue` untuk producer app didaftarkan `NotificationModule` (factory, tanpa `@nestjs/bullmq`); `Worker` + queue recovery dibuat factory di `apps/worker/src/app.module.ts`. Keduanya di-`onModuleDestroy`:

```ts
async onModuleDestroy() {
  await this.worker.close();
  await this.queue.close();
  await this.connection.quit();
}
```

**Handler `send`** (idempotent atas re-delivery):

1. Load row + `user.email/status` + baris preferensi `emailEnabled = false` (repository `findByIdForSend`). Row hilang (user cascade) → selesai.
2. `status !== PENDING` → return (sudah `SENT`/`FAILED`/`SKIPPED` = no-op; ini yang menahan duplikat).
3. User `status !== ACTIVE` atau preferensi `emailEnabled = false` → `SKIPPED`, return. Baris preferensi absen = enabled.
4. `SmtpService.isConfigured()` false → log `warn`, **return tanpa throw** (jangan bakar retry; row tetap `PENDING`, di-enqueue ulang job recovery). Dev tanpa SMTP tidak menghasilkan `FAILED`.
5. `SmtpService.send({ to, subject, text, html })`.
6. Sukses → `status = SENT`, `sentAt = now`, `lastError = null`.
7. Gagal → throw; BullMQ yang menghitung retry/backoff. `Worker` event `failed`: bila `job.attemptsMade >= (job.opts.attempts ?? 3)` → `status = FAILED` (hanya bila row masih `PENDING`, `updateMany`), `lastError = err.name[:code]` (≤200 char, tanpa PII). Attempt non-final **tidak** menulis `lastError`.
   **Catatan `lastError`**: `SmtpService.send` membungkus semua error transport jadi `BadGatewayException('Failed to send email')`, jadi kolom ini umumnya berisi `BadGatewayException` (generik). Detail asli (`EAUTH`, `ETIMEDOUT`, `ECONNECTION`, respons SMTP) hanya terlihat di **log server** (`SmtpService` menulis `SMTP send failed` + `name: message (code)`). Jangan bergantung pada `lastError` untuk diagnosa kredensial/koneksi.

**Job recovery** (repeatable, tiap 5 menit, queue yang sama):

- Didaftarkan sekali di bootstrap worker lewat `queue.upsertJobScheduler('notifications-recovery', { every: 300_000 }, { name: 'recover', data: {}, opts: { removeOnComplete: true } })`. Gagal daftar (Redis mati) hanya `warn`, boot tidak digagalkan; scheduler dibuat ulang saat worker restart (idempotent oleh `upsert`).
- Body: `notificationRepository.findDue(100)` (`status = PENDING`, `scheduledAt <= now`), lalu `addBulk` dengan `jobId = row.id` + `delay` dihitung ulang. Bila job ber-`jobId` itu masih ada dalam state `completed`/`failed` sementara row masih `PENDING` (mis. SMTP belum dikonfigurasi), `job.remove()` dulu lalu `add` lagi — kalau tidak, `jobId` menahan enqueue. `getJob`/`remove` per-row dibungkus `try/catch` (job bisa hilang karena race) dan dilanjutkan.
- Ini **bukan** poll pengiriman: hanya jaring pemulihan bila enqueue setelah commit gagal / Redis sempat mati. Normal: job sudah ada di Redis, tidak perlu scan.

**Job lifecycle** (repeatable, tiap 6 jam): scheduler `notifications-subscription-lifecycle` (`{ every: 21_600_000 }`, `name: 'subscription-lifecycle'`) didaftarkan di `onModuleInit` worker bersama recovery; handler memanggil `NotificationService.enqueueSubscriptionLifecycle()` (§5.6). Tidak ada query `Billing` di worker.

> **At-least-once.** BullMQ mengklaim job secara atomik (aman multi-instance), tetapi crash setelah `send()` sebelum update `SENT` bisa mengirim email dobel. Diterima; unique constraint mencegah enqueue dobel, bukan send dobel. `SKIPPED`/`SENT` di DB memotong duplikat pada re-delivery normal.

> **Eligibility snapshot (trade-off eksplisit).** Role, pengecualian creator/author, membership (`Archive.type = MEMBER`), dan visibility dievaluasi **saat enqueue** di transaksi publish. Worker **hanya** re-check `user.status` + baris preferensi; membership tidak dicek ulang karena row tidak menyimpan `archiveType`. Konsekuensi: membership yang expired/dicabut setelah enqueue tetap menerima email (dan sebaliknya user yang baru membeli tidak menerima email konten lama). Upgrade bila perlu: tambah kolom snapshot `requiresActiveMembership`/`archiveType` di `notifications` + re-check `billings` di worker.

### 5.6 Lifecycle membership

Recipient **selalu pemilik billing** (`Billing.userId`); tanpa broadcast admin, tanpa cek role/preferensi saat enqueue (preferensi tetap dicek worker saat kirim). Idempoten lewat unique `(userId, type, entityType, entityId)` + `createMany({ skipDuplicates: true })` — satu email per billing per tipe.

| Tipe | Pemicu | Query |
| --- | --- | --- |
| `SUBSCRIPTION_ACTIVE` | **`BillingService`** setelah billing tersimpan `status = PAID` + `expiryDate` terisi: `subscribe()` (Billing Management `/billings/subscribe` & approve subscription request), `create()` (bila `dto.status = PAID`), `update()` (bila hasil akhir `status = PAID`). Best-effort (`.catch`), tidak menggagalkan write. | — (pakai `BillingEntity` hasil write: `id`, `userId`, `subscription.name`, `expiryDate`) |
| `SUBSCRIPTION_EXPIRING` | Job repeatable tiap **6 jam** (`every: 21_600_000`) | `BillingService.findSubscriptionLifecycleRows(now)` → `BillingRepository.findExpiringSubscriptions(now, now + 7 hari)`: `status = PAID`, `expiryDate` di `(now, now+7d]` |
| `SUBSCRIPTION_EXPIRED` | Job yang sama | `BillingService.findSubscriptionLifecycleRows(now)` → `BillingRepository.findExpiredSubscriptions(now)`: `status = PAID`, `expiryDate <= now`, `canceledAt = null` |
| `SUBSCRIPTION_CANCELED` | `BillingService.cancel(id)` (admin, `DELETE /billings/:id`) setelah `BillingRepository.cancel` sukses. **Tidak** dipakai untuk auto-cancel billing `PAID` lama di dalam `subscribe()` (renewal menggantikan, bukan pembatalan). | — (pakai `BillingEntity` hasil cancel: `id`, `userId`, `subscription.name`, `canceledAt`) |

- `billing.service.ts`: `notifySubscriptionActive(billing)` diemit **setelah** row billing tersimpan (`subscribe`/`create`/`update` → `status = PAID` + `expiryDate`), best-effort `.catch(() => undefined)` — kegagalan notifikasi (DB/Redis) tidak boleh menggagalkan write/approve. Method `NotificationService` sendiri juga `try/catch` + `warn`. Duplikat `PAID→PAID` ditahan unique `(userId, type, entityType, entityId)` + `skipDuplicates`.
- `NotificationService.enqueueSubscriptionLifecycle(rows, now = new Date())`: menerima dua window (**EXPIRING** + **EXPIRED**) yang dirakit `BillingService.findSubscriptionLifecycleRows(now)` (query tetap di `BillingRepository`), merakit row (`body = formatDetails(...)`, `linkPath = '/my-billings'`), `createMany`, lalu `enqueuePending(SUBSCRIPTION, billingId)` per billing unik. Error → `warn`, return 0 (tidak menggagalkan job).
- Scheduler: `NotificationQueue.enqueueSubscriptionLifecycle()` → `upsertJobScheduler('notifications-subscription-lifecycle', { every: 21_600_000 }, { name: 'subscription-lifecycle', ... })`, didaftarkan di `apps/worker/src/app.module.ts` `onModuleInit` bersama recovery. Gagal daftar (Redis mati) hanya `warn`.
- Dispatch: `notification.processor.ts` menerima `subscription-lifecycle` lalu memanggil `BillingService.findSubscriptionLifecycleRows(now)` + `NotificationService.enqueueSubscriptionLifecycle(rows, now)`. Worker **tidak** query `Billing`/Prisma; query tetap di repository libs. Job idempotent karena `upsertJobScheduler` berbasis scheduler id + unique key DB.
- `EXPIRING`/`EXPIRED` yang sudah punya row (terkirim atau `SKIPPED`) tidak dikirim ulang; `ACTIVE` juga tidak menimpa row lama.
- `CANCELED`: `BillingService.cancel()` memanggil `NotificationService.notifySubscriptionCanceled(billing)` **setelah** write sukses, best-effort (`.catch` + `try/catch` internal) — kegagalan DB/Redis tidak menggagalkan cancel. Recipient = `billing.userId`; `entityType = SUBSCRIPTION`, `entityId = billing.id`; `body = Package + Canceled on` (`YYYY-MM-DD` UTC dari `canceledAt`, fallback `now` bila null). Billing hasil cancel sudah `expiryDate = null`, jadi tidak ada baris expiry. Dedupe lewat unique `(userId, type, entityType, entityId)`. Auto-cancel billing lama di `subscribe()` **tidak** memicu tipe ini (tidak ada email "canceled" saat renewal).

---

## 6. Struktur File

```text
libs/src/modules/notification/
├── notification.module.ts          ← export service/repository/queue
├── notification.service.ts         ← enqueue, list, markRead, markAllRead, preference
├── notification.repository.ts      ← satu-satunya query Prisma
├── notification.queue.ts           ← producer BullMQ (`Queue`, `enqueuePending`, `enqueueDue`, `enqueueRecovery`, `enqueueSubscriptionLifecycle`)
├── notification.template.ts        ← render subject/text/html + escape
├── dto/
│   ├── list-notifications-query.dto.ts
│   └── update-notification-preference.dto.ts   ← { emailEnabled: boolean }
└── entities/
    └── notification.entity.ts      ← select + entity notifikasi & preferensi

apps/worker/src/
├── app.module.ts                   ← factory provider `Worker` + connection ioredis
└── processors/
    └── notification.processor.ts   ← consumer `Worker` (handler `send`/`recover`/`subscription-lifecycle` + `failed`)

apps/app/src/controllers/
├── notifications.controller.ts
└── notification-preferences.controller.ts
```

Status implementasi:

| Komponen | Status |
| --- | --- |
| Enum/model `Notification`, `NotificationPreference`, `NotificationChannel` | ✅ |
| Migration `add_notifications` (+ `Archive.slug`) | ✅ |
| `NotificationModule` + repository/service/entity/template | ✅ |
| Hook publish di `post`/`event`/`archive` | ✅ (auto-publish `update()` hanya `scope.kind === 'all'`) |
| `notify` di `PublishContentDto` | ✅ |
| Dependency `bullmq` + provider `Queue` (libs) / `Worker` (worker) | ✅ |
| Processor `notification.processor.ts` + job recovery (`upsertJobScheduler`) | ✅ |
| Lifecycle membership (`ACTIVE` hook approve, `CANCELED` hook cancel, `EXPIRING`/`EXPIRED` job 6 jam) | ✅ |
| Env `NOTIFICATION_WORKER_CONCURRENCY` | ✅ |
| Controller `notifications` + `notification-preferences` | ✅ |
| FE mengirim `notify` + route slug | ❌ belum (di luar `backend/`) |

Wiring:

- `NotificationModule` di-`imports` + `exports` `libs/src/libs.module.ts`.
- `PostModule`/`EventModule`/`ArchiveModule` meng-`import` `NotificationModule` agar bisa inject `NotificationService` (tanpa siklus: notification tidak mengimpor domain konten).
- `BillingModule` meng-`import` `NotificationModule` (emisi `SUBSCRIPTION_ACTIVE`); `NotificationService` **tidak** lagi inject `BillingRepository` — window lifecycle dirakit `BillingService.findSubscriptionLifecycleRows` lalu diteruskan sebagai argumen. Tanpa siklus modul, tanpa `forwardRef`.
- Controller `notifications` + `notification-preferences` didaftarkan di `apps/app/src/app.module.ts`.
- `libs/src/index.ts` mengekspor module/service/DTO/queue yang dipakai controller & worker.
- `apps/worker/src/app.module.ts`: provider factory `Worker` + `NotificationQueue` (recovery) + `onModuleDestroy` (tutup worker/queue/koneksi). `LibsModule` tetap di-`imports` untuk `PrismaService`/`SmtpService`/`ConfigService`.
- `REDIS_URL` sudah wajib di `env.validation.ts` + `.env.example`; tidak ada env baru selain `APP_WEB_URL` dan `NOTIFICATION_WORKER_CONCURRENCY`.

---

## 7. Kontrak API Usulan

Semua path prefix **`/api/v1`**. Sukses `{ data, message }`; list `{ data, meta: { page, limit, total }, message }`; error `{ statusCode, message, errors }`. Endpoint di bawah **LOGIN-only** (self-scoped, `@CurrentUser()`), **tanpa permission baru**; RBAC/seed tidak berubah.

| Method | Path | Akses | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/notifications` | LOGIN-only (milik sendiri) | query `page, limit, sortBy, sortOrder, status?, unread?` | 200 `{ data: [notification], meta, message }` |
| POST | `/api/v1/notifications/:id/read` | LOGIN-only (milik sendiri) | — | 200 `{ data: <notification>, message }` |
| POST | `/api/v1/notifications/read-all` | LOGIN-only | — | 200 `{ data: { updated: n }, message }` |
| GET | `/api/v1/notification-preferences` | LOGIN-only (milik sendiri) | — | 200 `{ data: [{ type, channel, emailEnabled }], message }` |
| PATCH | `/api/v1/notification-preferences/:type` | LOGIN-only (milik sendiri) | `{ emailEnabled: boolean }` | 200 `{ data: { type, channel, emailEnabled }, message }` |

**Preferensi = endpoint terpisah**, bukan `/auth/me` (Q9). `/auth/me` **tidak berubah** — tidak ada field preferensi. Alasan: preferensi kini per `(type, channel)`, bukan satu boolean profil; mencampurnya di `UpdateProfileDto` akan memaksa at-least-one check + tipe data yang salah bentuk. Endpoint baru tetap LOGIN-only, tanpa permission.

### Preferensi

- `GET /api/v1/notification-preferences` → untuk **setiap** nilai `NotificationType`, isi default dari DB:
  `notificationPreferences.findMany({ where: { userId }, select: { type, channel, emailEnabled } })` lalu map semua `NotificationType` × `EMAIL`; absen → `emailEnabled: true`. Response selalu lengkap (FE tidak perlu tahu default).
- `PATCH /api/v1/notification-preferences/:type` body `{ emailEnabled: boolean }`:
  - `:type` divalidasi `@IsEnum(NotificationType)`; nilai invalid → **422** (bukan 400/404).
  - `channel` selalu `EMAIL` (tidak diekspos di body — belum ada channel lain).
  - Upsert `(userId, type, EMAIL)`: `upsert({ where: { userId_type_channel: { userId, type, channel: EMAIL } }, create: { userId, type, channel: EMAIL, emailEnabled }, update: { emailEnabled } })`. Idempotent.
  - Boleh mengirim `emailEnabled: true` untuk menghapus opt-out (row tetap ada; bukan delete).
- `type` adalah `NotificationType`, **bukan** `entityType`; nilai: `CONTENT_PUBLISHED`, `CONTENT_SUBMITTED`, `SUBSCRIPTION_REQUEST_SUBMITTED`, `SUBSCRIPTION_ACTIVE`, `SUBSCRIPTION_EXPIRING`, `SUBSCRIPTION_EXPIRED`, `SUBSCRIPTION_CANCELED`.

### Query list

| Item | Nilai |
| --- | --- |
| `status?` | `@IsEnum(NotificationStatus)` |
| `unread?` | boolean (`@Transform` dari `'true'`/`'false'`), `true` → `readAt: null` |
| `NOTIFICATION_SORT_FIELDS` | `['createdAt', 'readAt']` (default `createdAt desc`) |
| `NOTIFICATION_FILTER_FIELDS` | `['status', 'readAt', 'createdAt']` |
| `limit` | default 20, clamp 100 |
| Select response | `id, type, entityType, entityId, title, body, imageUrl, linkPath, readAt, createdAt` |
| Tidak diekspos | `lastError`, `scheduledAt`, `sentAt`, `status` internal worker (boleh `status` bila FE butuh; default tidak) |

- Notification milik user lain pada `:id/read` → **404** (bukan 403) agar tidak membocorkan keberadaan row.
- `read-all` idempotent: `updateMany({ where: { userId, readAt: null }, data: { readAt: now } })`.
- Mark-read idempotent: set `readAt` hanya bila masih `null` (nilai lama tidak berubah).

### Integrasi body publish existing

`libs/src/common/dto/publish-content.dto.ts`:

```ts
import { IsBoolean, IsISO8601, IsOptional } from 'class-validator';

export class PublishContentDto {
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;

  // FE checkbox "Notify members by email"; default true.
  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}
```

Controller `posts`/`events`/`archives` meneruskan `{ publishedAt: dto?.publishedAt, notify: dto?.notify }` ke `transition()`. Service memakai `notify !== false`.

---

## 8. Template & Isi Email

Env baru (app **dan** worker; worker yang merakit URL):

```ts
// libs/src/common/config/env.validation.ts
APP_WEB_URL: Joi.string().uri().optional(),
```

- Spread ke `appEnvValidationSchema` **dan** `workerEnvValidationSchema` (template dirender worker).
- Opsional agar dev tetap boot. Bila kosong: email tetap dikirim tanpa link (text/HTML fallback), atau lewati link — pilih "tanpa link" + log `warn` sekali.
- `.env.example` ditambah `APP_WEB_URL=https://app.example.com`.

Template (`notification.template.ts`, tanpa engine/i18n framework):

```ts
renderNotification({ type, entityType, title, excerpt?, url?, imageUrl?, recipientName?, logoUrl? })
```

Struktur email:

1. **Header band** — wordmark EGS: `<img src="{APP_WEB_URL}/logo.png" alt="European Gamelan Society" width="160" height="83">` (rasio 1.93:1), ditautkan ke root situs (`APP_WEB_URL`). `logoUrl` null (env kosong) → wordmark teks serif `European Gamelan Society`, **bukan** `<img>` rusak.
2. Pembuka `Hello <Nama>,` (fallback `Hello,`) + satu kalimat pembuka + satu kalimat konteks (per tipe). Untuk tipe admin, pembuka menandakan ada yang menunggu diproses (bukan sapaan "thank you").
3. Thumbnail 16:9 (bila `imageUrl`) di atas kartu, radius 4px. Tanpa `imageUrl` → tanpa `<img>` (tanpa placeholder).
4. **Kartu konten** — seluruh kartu adalah tautan: label tipe (terracotta, uppercase 12px), judul serif 26px/34px. Tanpa `url` → kartu tanpa tautan.
5. **Blok detail** (tipe admin & lifecycle membership) — kartu terpisah, baris label/value dari `body` (`Label: value` per newline), dipisah border 1px `#E0D5C5` (border-top tiap baris kecuali baris pertama). Label 140px uppercase 11px `#555555`, value 15px `#2D1F1A`; semua nilai `escapeHtml`.
6. **Tombol CTA** fallback: `#8B2E3B`, teks ivory, radius 2px, padding 14px 26px, uppercase 13px, tracking 0.08em.
7. **Footer** — band charcoal `#2D1F1A` (radius 4px, full-bleed 600px): `European Gamelan Society` (serif 15px, ivory), `info@europeangamelansociety.com`, `This email was sent automatically by EGS.` (`#E0D5C5`, 12px).

Logo (prasyarat FE): file `frontend/public/logo.png` (rasio 1.93:1) + `APP_WEB_URL` terisi. Worker merakit `buildAssetUrl(APP_WEB_URL, 'logo.png')`; base kosong/non-http → `null` → wordmark teks.

`renderNotification({ type, entityType, title, excerpt?, url?, imageUrl?, recipientName? })` — `excerpt` = isi kolom `body`; untuk tipe admin & lifecycle membership dibaca sebagai baris detail, untuk `CONTENT_PUBLISHED` tidak dirender.

**Sapaan personal.** `recipientName` diisi worker dari `User.fullName` (karena itu `notificationSendSelect` **wajib** men-select `fullName`). Template memakai `Hello <nama>,` untuk **semua** tipe (termasuk `CONTENT_SUBMITTED` & `SUBSCRIPTION_REQUEST_SUBMITTED`) di html **dan** `text`; nama di-`trim`, `escapeHtml`, tanpa pemecahan nama. Nama kosong/whitespace-only atau field tidak dikirim → `Hello,` (perilaku lama).

| Item | Nilai |
| --- | --- |
| Layout | `<table role="presentation">` + CSS inline; kolom 600px; tanpa flex/grid; `<style>@import` Google Fonts (progressive enhancement) |
| Font | heading serif `'Cormorant Garamond',Georgia,'Times New Roman',serif`; body `'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif` 16px/26px (fallback system bila webfont diblokir) |
| Palette | page/ivory `#F5F0E0`, card `#FAF7EE`, ink/charcoal `#2D1F1A`, terracotta `#8B2E3B`, muted `#555555`, border/sand `#E0D5C5` |
| Radius | kartu & footer 4px, CTA 2px |
| CTA | bg `#8B2E3B`, teks `#F5F0E0`, padding 14px 26px, 13px uppercase, letter-spacing 0.08em |
| Gambar | hanya `http(s)`; `display:block;width:100%;height:240px;object-fit:cover`; `alt` = judul |
| Logo | `APP_WEB_URL` + `frontend/public/logo.png` (160×83); base kosong → wordmark teks serif |
| URL | hanya `http(s)`; selain itu kartu tanpa tautan + CTA dihilangkan; selalu `escapeHtml` |
| Text alt | `Hello <nama>,` (fallback `Hello,`) + kalimat pembuka + kalimat tipe + judul + baris detail (tipe admin) + URL (mirror HTML); tidak berubah karena restyle |
| Escape | judul/label/kalimat/baris detail di-escape (`escapeHtml`); excerpt dari `sanitize-html({ allowedTags: [] })` |

| Subject | Pola |
| --- | --- |
| `CONTENT_PUBLISHED` | `New <Label> "<title>" is now live` |
| `CONTENT_SUBMITTED` | `New <Label> "<title>" is waiting for your review` |
| `SUBSCRIPTION_REQUEST_SUBMITTED` | `Subscription request from <title> is waiting for your review` |
| `SUBSCRIPTION_ACTIVE` | `Your EGS membership is now active` |
| `SUBSCRIPTION_EXPIRING` | `Your EGS membership expires in 7 days` |
| `SUBSCRIPTION_EXPIRED` | `Your EGS membership has expired` |
| `SUBSCRIPTION_CANCELED` | `Your EGS membership has been canceled` |

Tanpa `:` dan tanpa dash (`-`, `–`, `—`) di luar judul; judul disisipkan mentah (tidak di-escape) seperti sebelumnya.

Label: `POST=Story`, `EVENT=Event`, `ARCHIVE=Archive`, `NETWORK=Network`, `SUBSCRIPTION_REQUEST=Subscription`, `SUBSCRIPTION=Membership`.

Greeting (member, termasuk lifecycle): `Hello <nama>,` (fallback `Hello,`) + `Thank you for being part of the European Gamelan Society. We're writing to keep you up to date with what's happening across the platform.`

Intro lifecycle (menggantikan kalimat konteks): ACTIVE `Your membership is active and your benefits are ready to use.`; EXPIRING `Your membership will end soon. Renew to keep your benefits without interruption.`; EXPIRED `Your membership has ended. You can renew at any time to restore your benefits.`; CANCELED `An administrator has canceled your membership. Reply to this email if you believe this was a mistake.`

Kalimat pembuka (tipe admin, menggantikan sapaan): `A new <Label> submission is waiting for you to review.` / `A new subscription request is waiting for you to review.` Baris konteks: `Sign in to the dashboard to approve or reject it.`; published → `A new piece of content has just been published on the EGS platform.` Khusus tipe admin (`ADMIN_TYPES = {CONTENT_SUBMITTED, SUBSCRIPTION_REQUEST_SUBMITTED}`); lifecycle adalah member-facing.

CTA: `Read more` (published) / `Review submission` (`CONTENT_SUBMITTED`) / `Process request` (`SUBSCRIPTION_REQUEST_SUBMITTED`) / `View membership` (`SUBSCRIPTION_ACTIVE` + `SUBSCRIPTION_CANCELED`) / `Renew membership` (`SUBSCRIPTION_EXPIRING` + `SUBSCRIPTION_EXPIRED`).

Detail lifecycle: `Package` = nama paket, `Active until` (ACTIVE) atau `Expires on` (EXPIRING/EXPIRED) dalam `YYYY-MM-DD` UTC (`formatNotificationDate`), plus `Days left` (`ceil((expiry - now)/86400000)`, min 1) untuk EXPIRING. CANCELED: `Package` + `Canceled on` (`canceledAt` → `YYYY-MM-DD` UTC, fallback hari ini); tanpa baris expiry karena `expiryDate` sudah null.

| Item | Nilai |
| --- | --- |
| Key i18n (reserved) | `notification.contentPublished.subject`, `.text`, `.html` |
| Link path | `POST` → `/stories/{slug}`, `EVENT` → `/events/{slug}`, `ARCHIVE` → `/archives/{slug}`, `NETWORK` → `/networks/{slug}`, `SUBSCRIPTION_REQUEST` → `/subscription-requests/{id}`, `SUBSCRIPTION` → `/my-billings` |
| Link submission admin | Konten submission → `/dashboard`; subscription request → `/subscription-requests/{id}` |
| Thumbnail | Publish: `thumbnail` Post/Event/Archive. Submission: Post `thumbnail`, Archive `dto.thumbnail`; Event/Network/subscription `null`. |
| Prasyarat slug | `Post.slug`/`Event.slug`/`Archive.slug` sudah ada (Archive: unique + retry `-2`, `-3` pada P2002). Route FE `/archives/:slug` wajib live agar link archive tidak 404. |
| Fallback | `text` selalu diisi; klien tanpa HTML tetap dapat salam + kalimat + judul + link. |
| PII | Jangan log email/body. Worker log hanya `notification.id`, `status`, `job.id`, `attemptsMade`, `error.name/code`. |

---

## 9. Idempotency & Edge Cases

| Kasus | Perilaku | Alasan / catatan |
| --- | --- | --- |
| Double approve / dua request paralel | Satu sukses, satu **409** (`updateStatusIf` conditional) | Notifikasi hanya dibuat oleh request yang menang; `createMany skipDuplicates` sebagai lapis kedua |
| Retry HTTP setelah publish sukses | Tidak ada row baru (unique) | Idempotent by DB |
| `unpublish` → publish lagi | **Tidak** ada email kedua | D6: sekali per konten per user. Bila produk ingin re-announce, ubah unique key jadi `(userId, type, entityType, entityId, publishedAt)` (migration + row baru tiap publish). **Keputusan: kirim sekali.** |
| `notify = false` | Tidak ada row sama sekali | Flag hanya di body action; tidak disimpan |
| User dihapus sebelum kirim | Row ikut terhapus (`onDelete: Cascade`) | Tidak ada email ke alamat mati |
| User nonaktif/opt-out setelah enqueue | `SKIPPED` saat worker; tanpa SMTP | Preferensi/status adalah keputusan saat kirim; membership **tidak** dicek ulang |
| Baris `NotificationPreference` tidak ada | Dianggap `emailEnabled = true` | Default di query recipient (`none` filter) dan di respons `GET /notification-preferences`; tanpa backfill |
| Membership expiry antara enqueue & kirim (`Archive.type = MEMBER`) | Email **tetap terkirim** | Eligibility snapshot saat publish; worker tidak tahu archive type (§5.5). Mitigasi: simpan `requiresActiveMembership` di row |
| `Archive.slug` | ✅ sudah ada (`@unique`, backfill unik `-2`, `-3`; service retry P2002) | Slug duplikat pada create/submit publik tidak lagi 409 acak | Route FE `/archives/:slug` tetap prasyarat link (§8) |
| Email invalid | `SmtpService` gagal → retry BullMQ → `FAILED` | Tidak ada validasi ulang di worker; email divalidasi saat register |
| SMTP down / salah kredensial | Job retry exponential (1m, 2m); attempt final → `FAILED` + `lastError` | Publish tetap sukses; error tidak bocor ke client |
| SMTP belum dikonfigurasi (dev) | Handler return tanpa throw; row tetap `PENDING`, recovery enqueue ulang | Jangan bakar retry / tandai `FAILED` di dev |
| Redis mati saat publish | Publish sukses; row `PENDING`; recovery job (5 menit) meng-enqueue saat Redis hidup | D12; `jobId` cegah job ganda |
| `publishedAt` masa depan | Row `PENDING`, `scheduledAt` future, job delayed (`delay`) | BullMQ memproses saat delay habis |
| Konten PRIVATE | Tidak ada row | D10 |
| Visibility diubah PUBLIC→PRIVATE setelah enqueue | Email tetap terkirim | Snapshot keputusan publish; tidak ada re-check lintas tabel |
| Konten dihapus setelah enqueue | Row tetap; link bisa 404 | Tidak ada FK polimorfik. Mitigasi: panggil `NotificationService.removeByEntity(entityType, entityId)` di `remove()` konten (best-effort) — backlog/opsional |
| Slug berubah setelah enqueue | Link memakai slug lama | `linkPath` snapshot untuk Post/Event/Archive; mitigasi: redirect FE atau link by id |
| Worker crash setelah `send()` | Mungkin email dobel | At-least-once (BullMQ menjalankan ulang job); handler skip row non-`PENDING` |
| Multi-worker | Aman | BullMQ klaim job atomik; `concurrency` per instance via env |
| Job recovery ganda / duplicate enqueue | No-op | `jobId = notification.id` + handler skip non-`PENDING` |
| Read/unread | `readAt` null = unread | Index `(userId, readAt)` |
| Lifecycle dobel job / worker restart | Tidak ada email kedua | `upsertJobScheduler` idempotent + unique `(userId, type, entityType, billingId)` |
| Billing dibatalkan sebelum kirim EXPIRING | Email tetap terkirim (sudah ter-enqueue) | Snapshot query; `cancel()` mengosongkan `expiryDate`, window berikutnya tidak lagi cocok |
| Notifikasi ACTIVE gagal (DB/Redis) | Billing/approval tetap sukses | Emisi di `BillingService` dibungkus `.catch`; `notifySubscriptionActive` sendiri `try/catch` + `warn` |

---

## 10. Testing Plan

### Unit

| Spec | Cakupan |
| --- | --- |
| `notification.service.spec.ts` | Recipient hanya ACTIVE + role member/author + preferensi tidak `false`; creator **dan** author konten dikecualikan; `Archive.type = MEMBER` difilter `Billing` PAID & belum expiry, `PUBLIC`/Post/Event tanpa filter; `notify: false` → `createMany` tidak dipanggil; `scheduledAt = publishedAt` untuk future; `skipDuplicates: true`. |
| `notification.processor.spec.ts` | Mock `SmtpService` + `Worker`/job palsu: sukses → `SENT` + `sentAt`; row non-`PENDING` (sudah `SENT`) → no-op (SMTP tidak dipanggil); user nonaktif / preferensi `emailEnabled = false` → `SKIPPED`; baris preferensi absen → tetap dikirim; `SmtpService.isConfigured() === false` → tidak throw, row tetap `PENDING`; error SMTP → throw; event `failed` attempt final → `FAILED` + `lastError` aman, attempt non-final tidak menulis `lastError`. Retry/backoff **tidak** diuji di sini (milik BullMQ). |
| `notification.queue.spec.ts` | `enqueuePending` mock `Queue.addBulk`: `jobId = row.id`, `delay = max(0, scheduledAt - now)`, `attempts: 3`, `backoff` exponential, `removeOnComplete/Fail`; duplicate `jobId` → tidak ada job kedua (mock mengembalikan job existing); recovery memilih `PENDING` due saja. |
| `notification.template.spec.ts` | Escape `title`/`excerpt`; URL dirakit dari `APP_WEB_URL`; fallback `text` tanpa `APP_WEB_URL`; subject admin `Action needed: …`; blok detail (label/value) muncul di html + text hanya untuk tipe admin. |
| `notification-preference` (service/controller) | `GET` mengisi default `emailEnabled: true` untuk tipe tanpa row; `PATCH` upsert idempotent; `type` invalid → 422. |
| Idempotency | Dua enqueue untuk key sama → `createMany` count 0 pada panggilan kedua (mock) / assert unique constraint behavior. |
| `notification.service.spec.ts` (submission) | `findAdminRecipientIds` memfilter `ACTIVE` + `role.code = admin` + preferensi tipe tidak false; `notifyAdmins` membuat row + enqueue; tanpa admin → tanpa row/job; error DB/queue tidak melempar. |
| `notification.service.spec.ts` (lifecycle) | `notifySubscriptionActive` row ACTIVE + enqueue; `enqueueSubscriptionLifecycle(rows, now)` merakit dari baris yang diberikan, memfilter `expiryDate` null, dedupe enqueue per billing, error → 0 tanpa throw. |
| `billing.repository.lifecycle.spec.ts` | `findExpiringSubscriptions` → `PAID`, `expiryDate` di `(now, now+7d]`; `findExpiredSubscriptions` → `PAID`, `expiryDate <= now`, `canceledAt: null`; select minimal (`id/userId/expiryDate/subscription.name`). |
| `billing.service.subscribe.spec.ts` | `subscribe` PAID / `create` PAID / `update` → PAID memicu `notifySubscriptionActive` sekali; `create` PENDING / `expiryDate` null → tidak; `PAID→PAID` tetap memanggil (dedupe DB); notify throw → write tetap sukses. |
| `subscription-request.service.spec.ts` | `approve` memicu `BillingService.subscribe` sekali (emisi ACTIVE ikut di sana, bukan di service request); notifikasi gagal → tetap APPROVED, tanpa `revertPending`. |
| `notification.queue.spec.ts` (lifecycle) | Scheduler `notifications-subscription-lifecycle` `{ every: 21_600_000 }`; Redis gagal → tidak melempar. |
| `notification.processor.spec.ts` (lifecycle) | Job `subscription-lifecycle` → `BillingService.findSubscriptionLifecycleRows(now)` lalu `NotificationService.enqueueSubscriptionLifecycle(rows, now)` (worker tanpa query Billing/Prisma). |

Contoh perintah:

```bash
pnpm exec jest libs/src/modules/notification --runInBand
pnpm exec jest apps/worker/src/processors/notification.processor.spec.ts --runInBand
```

### Manual (MailHog)

```bash
docker run -d --name mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

1. Set `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_SECURE=false`, `SMTP_FROM=dev@localhost`, `APP_WEB_URL=http://localhost:5173`, `REDIS_URL=redis://localhost:6379`, `NOTIFICATION_WORKER_CONCURRENCY=5`; jalankan app **dan** worker.
2. Buat user role `member` (ACTIVE, tanpa baris preferensi = enabled) + satu user `admin`.
3. `POST /api/v1/posts` → `submit` → `approve` dengan `{ "publishedAt": "<sekarang>" }`.
4. Cek inbox <http://localhost:8025>: satu email; pastikan user admin **tidak** menerima; ulangi approve → 409, tidak ada email kedua.
5. `approve` dengan `{ "notify": false }` pada konten lain → tidak ada email.
6. Set `publishedAt` +1 jam → tidak ada email sampai jam tersebut; cek Redis (`redis-cli ZRANGE bull:notifications:delayed 0 -1`) ada job delayed dengan `jobId = notification.id`; setelah due → terkirim.
7. `PATCH /api/v1/notification-preferences/CONTENT_PUBLISHED { "emailEnabled": false }` → publish berikutnya tidak menghasilkan row; `true` → row lagi.
8. Matikan MailHog → publish → row tetap `PENDING`; nyalakan → retry mengirim (backoff 1m/2m; attempt ke-3 `FAILED`).
9. Matikan Redis → publish → sukses, row `PENDING`; nyalakan Redis → job recovery (≤5 menit) mengirim.

### Verifikasi repo

```bash
pnpm tsc --noEmit
pnpm exec jest
pnpm run build
```

---

## 11. Rollout Checklist & Backlog

Urutan (jangan lompat):

1. **Prasyarat `Archive.slug`** (Q7): tambah `slug String @unique` di `model Archive`, migration `ALTER` + backfill unik (name + suffix) + unique index; route FE `/archives/:slug` harus live **sebelum** email archive dikirim. `Post.slug`/`Event.slug` sudah ada.
2. **Schema notifikasi**: enum `NotificationType`/`NotificationEntityType`/`NotificationStatus`/`NotificationChannel` + `model Notification` + `model NotificationPreference` + relasi `User.notifications`/`User.notificationPreferences` di `libs/prisma/schema.prisma`.
3. **Migration**: folder `20261019120000_add_notifications` + `migration.sql` (§4); apply `pnpm prisma:migrate:deploy` (atau `migrate dev` bila riwayat bersih).
4. `pnpm prisma:generate`.
5. **Env**: `APP_WEB_URL` + `NOTIFICATION_WORKER_CONCURRENCY` (default 5) di `env.validation.ts` (app + worker) + `.env.example`. `REDIS_URL` sudah wajib — tidak ada perubahan.
6. **Modul**: `notification.entity.ts` + `notification-preference.entity.ts` → `notification.repository.ts` → `notification.service.ts` → `notification.template.ts` → `notification.queue.ts` → `notification.module.ts`; daftarkan di `libs.module.ts` + `libs/src/index.ts`.
7. **DTO + hook publish**: `PublishContentDto.notify`; `updateStatusIf(..., tx)`; `enqueueContentPublished` di `post`/`event`/`archive` `transition()` + jalur auto-publish `create`/`update` (kirim `archiveType` untuk `ARCHIVE`). Enqueue BullMQ (`enqueuePending`) dipanggil **setelah** transaksi commit, `try/catch` + log.
8. **Queue + worker**: dependency `bullmq` (app & worker workspace); provider `Queue` di `NotificationModule` (koneksi bounded `maxRetriesPerRequest: 3` + `enableOfflineQueue: false`); factory `Worker` + connection `ioredis` (`maxRetriesPerRequest: null`) + `onModuleDestroy` di `apps/worker/src/app.module.ts`; `notification.processor.ts`; job recovery via `upsertJobScheduler({ every: 300_000 })` + lifecycle via `{ every: 21_600_000 }` saat bootstrap worker. Tanpa `@nestjs/schedule`.
9. **API**: `notifications.controller.ts` + `notification-preferences.controller.ts`; daftarkan di `apps/app/src/app.module.ts`. **Tidak ada** perubahan `/auth/me`, `UpdateProfileDto`, atau `userSelect`.
10. **Seed**: tidak ada perubahan permission; jalankan `pnpm prisma:seed` hanya untuk verifikasi idempoten.
11. **Test**: spec unit + `pnpm tsc --noEmit` + `pnpm exec jest` + `pnpm run build`; uji manual MailHog.
12. **FE** (task terpisah, di luar `backend/`): checkbox mengirim `notify`; list notifikasi + mark-read; toggle preferensi via `/notification-preferences`; **dukungan route slug** `/stories/:slug`, `/events/:slug`, `/archives/:slug` (saat ini `:id`).

**Backlog:**

- Queue terpisah / rate limit provider (throughput, prioritas, `limiter`).
- Job recovery berbasis `QueueEvents`/`FlowProducer` bila scan periodik dirasa cukup mahal.
- Re-check membership di worker (butuh snapshot `archiveType`/`requiresActiveMembership` di row).
- Preferensi per kategori/frekuensi/digest, unsubscribe publik bertoken.
- Push/in-app realtime; i18n penuh; template HTML branded.
- Notifikasi event billing lain (reject, refund, renewal reminder berulang), hanya ACTIVE/EXPIRING/EXPIRED yang masuk scope.
- Bounce/complaint handling, provider transaksional (SES/Resend).
- Retensi/cleanup row `SENT` lama (mis. >180 hari).
- Re-notify konten yang di-update (unique key ber-`publishedAt`).

---

## 12. Keputusan Final

| # | Keputusan | Konsekuensi di dokumen |
| --- | --- | --- |
| Q1 | Recipient = `User.status = ACTIVE` **dan** `role.code IN ('member','author')` | Definisi member §1; query §5.3 |
| Q2 | Creator konten **dikecualikan** | `id: { notIn: [creatorId, ...] }` §5.3 |
| Q3 | Author konten (`PostAuthor`/`EventAuthor`/`ArchiveAuthor`) **bukan** recipient — dikecualikan, bukan sekadar dedupe | Ambil `authorIds` per entity di transaksi publish §5.3 |
| Q4 | `Archive.type = MEMBER` → hanya user dengan membership berbayar aktif (`Billing.status = PAID` dan `expiryDate > now`, mirror `BillingRepository.hasActiveByUser`); `PUBLIC`/Post/Event tanpa filter | Filter `billings.some` §5.3; eligibility snapshot §5.5/§9 |
| Q5 | Notifikasi future `publishedAt` dikirim saat `publishedAt` tercapai | Row `PENDING` + `scheduledAt = publishedAt` + BullMQ `delay` (D7/§5.2) |
| Q6 | Sekali per konten per user, **selamanya**; re-publish setelah unpublish tanpa email kedua | Unique key tanpa `publishedAt` (D6/§9) |
| Q7 | Semua link email pakai **slug**: `/stories/{slug}`, `/events/{slug}`, `/archives/{slug}` | `Archive.slug` sudah ada (unique + retry suffix); route FE `/archives/:slug` wajib untuk link (§4/§8/§11); slug berubah setelah enqueue = snapshot lama (§9) |
| Q8 | Tidak ada halaman/endpoint monitoring admin untuk sekarang | Out of scope; tanpa permission baru |
| Q9 | Pakai tabel `NotificationPreference` granular sejak migration pertama, bukan kolom boolean di profil | Model + enum channel §3; migration §4; endpoint §7; worker re-check §5.5 |
| Q10 | Worker pengiriman = **BullMQ** (raw `bullmq`, queue `notifications`) di Redis existing; retry/backoff/delay/concurrency milik BullMQ; enqueue setelah commit + job recovery | D1/D7/D9/D12; §5.2/§5.5; struktur file §6; testing §10; rollout §11 |

### Pertanyaan Terbuka (baru)

Tidak ada. Item produk yang belum diminta (retensi row `SENT`, re-notify saat update, preferensi frekuensi/digest, unsubscribe publik) tetap di backlog §11 — bukan blocker implementasi.
