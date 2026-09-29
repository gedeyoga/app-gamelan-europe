# Module: Approval Member — Proposal Desain

> **STATUS: PROPOSAL DESAIN — belum ada perubahan kode.** Dokumen eksplorasi untuk menyatukan tampilan tiga antrean approval admin di `/` (`dashboard-home.tsx`). Tidak ada komponen/i18n/query yang diubah oleh dokumen ini. Implementasi menyusul (lihat §8).

Menu: [dashboard.md](./dashboard.md) (§10b/§10f/§10g/§10h) · [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) · [AGENTS.md](../../AGENTS.md) · backend: [event.md](../../../backend/docs/modules/event.md) · [archive.md](../../../backend/docs/modules/archive.md) · [rbac.md](../../../backend/docs/modules/rbac.md)

---

## 1. Ringkasan & Tujuan

Dashboard admin (`/`) kini menampilkan **tiga** antrean approval dengan **tiga** bahasa visual berbeda:

| Antrean | Komponen | Bahasa visual saat ini | Endpoint |
| --- | --- | --- | --- |
| Event member/org | `dashboard-pending-events.tsx` | Baris tipis: thumbnail 48px + teks + 3 tombol (§10b) | `GET /events?filter[status]=REQUEST` |
| Arsip member | `dashboard-pending-archives.tsx` | Baris tipis (mirror event) + deskripsi/kategori (§10f) | `GET /archives?filter[status]=REQUEST` |
| Submission publik | `dashboard-pending-submissions.tsx` | **Kartu media**: thumbnail kiri 16:9, judul, ikon organiser/lokasi/tanggal, aksi, hover lift (§10h) | `GET /event-submissions?filter[status]=REQUEST` |

**Masalah:**

1. **Inkonsisten 3 queue.** Submissions sudah pakai kartu media; Events/Archives masih baris tipis. Admin berpindah “gaya” saat memindai halaman yang sama.
2. **Identitas member/penyelenggara tenggelam.** Pada baris tipis, `creatorName` satu baris `text-muted-foreground` — sulit membedakan siapa mengajukan apa.
3. **Minim konteks konten.** Event tidak menampilkan organisasi/lokasi/tipe; arsip hanya satu baris deskripsi. Admin harus klik “Lihat detail” untuk menilai.
4. **Sulit scan.** Baris seragam tanpa hierarki visual membuat antrean panjang melelahkan dipindai.
5. **Pembedaan jenis tidak konsisten.** Event dan archive `REQUEST` vs submission `REQUEST` hanya dibedakan judul section.

**Tujuan:**

- Satu **kartu approval** seragam untuk Event & Archive (dan Submission), selaras kartu submission terbaru.
- Menonjolkan identitas pengaju + konteks konten tanpa membuka detail.
- Membedakan **event member**, **arsip member**, dan **submission publik** tanpa field `source` — lewat judul section, ikon, dan label badge (bukan warna saja).
- Tetap **dashboard** (padat, banyak dalam viewport), bukan landing page.

**Non-tujuan:** tidak menyentuh backend, tidak menambah route/halaman, tidak mengubah alur approve/reject (dialog `PublishScheduleDialog` / `AlertDialog` tetap).

---

## 2. Prinsip Desain

1. **Selaras DESIGN_SYSTEM** — hanya token (`bg-card`, `text-muted-foreground`, `border`, `bg-muted`, `text-primary`, `bg-primary/10`), radius skala token, ikon `lucide-react`, `cn()` untuk override `className`. Larang hardcode warna/radius.
2. **Konsisten dengan kartu submission baru** (§10h) — struktur kartu media yang sama agar tiga antrean terasa satu keluarga; perbedaan via aksen/ikon/label, bukan layout berbeda.
3. **Tetap dashboard** — kartu `Card size="sm"`-setara, media `sm:w-48`, tinggi terkontrol, `limit=5` + pagination tetap. Bukan grid besar ala katalog publik.
4. **Aksesibel** — badge wajib punya **teks**, bukan hanya warna; `aria-busy` + `disabled` saat `busy`/`isRefreshing` dipertahankan; tombol ikon punya `aria-label`; hover-only affordance `aria-hidden`.
5. **`prefers-reduced-motion`** — semua animasi lift/zoom dibungkus `motion-safe:` (pola `CARD_HOVER_CLASS` submissions).
6. **Light/dark** — tanpa asumsi latar terang; foto thumbnail diberi perlakuan netral, gradient overlay pakai token (`from-card`/`from-foreground`), kontras teks di overlay terjaga di dua mode.
7. **Presentational murni** — komponen approval tetap tanpa import lintas domain; data dipetakan di route (`dashboard-home.tsx`), efek samping via props `onApprove`/`onReject`/`onViewDetail` (AGENTS.md §Reusable Component).

---

## 3. Arah Desain

Tiga arah. Ketiganya mempertahankan perilaku & props aksi yang ada.

### Opsi A — Unified approval card

Kartu media seragam untuk Event & Archive; perbedaan jenis via badge aksen + ikon + label.

**Desktop (≥sm):**

```
┌────────────────────────────────────────────────────────────┐
│ ┌────────────┐  ┌──────────────┐  Judul event / arsip       │
│ │            │  │ ▣ Diajukan   │  ──────────────────        │
│ │  thumbnail │  └──────────────┘  👤 Nama / 🏢 Organisasi   │
│ │   16:9     │                    📍 Lokasi      (event)    │
│ │            │                    🏷 Kategori    (archive)  │
│ └────────────┘  📅 Tanggal (mulai – selesai)                │
│ ────────────────────────────────────────────────────────── │
│                            [👁 Lihat]  [✓ Setujui]  [✕ Tolak] │
└────────────────────────────────────────────────────────────┘
```

**Mobile (<sm):** thumbnail full-width atas (16:9), body stack di bawah, baris aksi full-width (tombol `flex-1`).

**Struktur kartu:**

- Akar: `Card overflow-hidden p-0` + `CARD_HOVER_CLASS` (`shadow-sm motion-safe:transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md`).
- Thumbnail: `relative aspect-video w-full sm:w-48` + `object-cover`; fallback `bg-muted` + `ImageOff` + label `common:eventCard.noThumbnail`.
- Badge status di kanan-atas judul (reuse `event:statusOptions.REQUEST` / `archive:statusOptions.REQUEST`, plus badge jenis untuk member).
- Metadata: baris ikon `size-3.5` + teks `truncate` (pola submission).
- Footer aksi: `border-t pt-3`, `justify-end`, tombol sm; tambah **Lihat detail** (event & archive) yang submissions tidak punya.

**Urutan metadata:** judul → pengaju (member/organisasi) → tanggal → lokasi (event) / kategori (archive).

**Pro:**

- Paling **murah**: reuse ~90% kartu submissions; cukup ekstraksi 1 komponen presentational.
- Konsisten penuh tiga antrean; admin memindai dengan mata yang sama.
- Responsif aman (pola submission sudah `flex-col sm:flex-row`).
- Muat banyak item; pagination existing tetap bekerja.

**Kontra:**

- Kurang “mewah” dibanding grid; foto kecil (`sm:w-48`).
- Judul + metadata bisa sesak pada `sm` sempit; perlu `min-w-0`/`truncate` disiplin.

### Opsi B — Master–detail split

Dua kolom: list kiri, panel pratinjau kanan untuk item terpilih.

**Desktop (lg+):**

```
┌────────────────────────┬──────────────────────────────────────┐
│ Antrean (5)            │  Pratinjau                           │
│                        │  ┌──────────────┐                    │
│ ▸ Judul Event A        │  │    cover     │  Judul             │
│   👤 Budi · Member     │  │    16:9      │  ─────────────     │
│ ─────────────────────  │  └──────────────┘                    │
│ ▸ Judul Arsip B        │  👤 Budi                             │
│   🏢 Org X             │  🏢 Organisasi X                     │
│ ─────────────────────  │  🏷 Kategori A · B                   │
│ ▸ Judul Event C        │  📅 15 Jan 2026 · 19:30–22:00        │
│                        │  📝 Deskripsi…                       │
│ [Sebelumnya][Berikut]  │  [👁 Lihat] [✓ Setujui] [✕ Tolak]   │
└────────────────────────┴──────────────────────────────────────┘
```

**Mobile (<lg):** satu kolom; daftar → tap item → panel tampil menggantikan list (atau `Sheet`/`Drawer`).

**Struktur:** list item ramping (thumbnail 40px + judul + pengaju + chevron) dengan `aria-selected`; panel kanan konten detail ringan.

**Pro:**

- Paling informatif — admin menilai tanpa berpindah halaman.
- Mengurangi klik “Lihat detail”.
- Skala baik saat antrean panjang.

**Kontra:**

- **Paling mahal** & paling banyak state (selectedId, reset saat refetch, sinkron pagination).
- Bukan pola dashboard existing; menambah kompleksitas di `dashboard-home.tsx` yang sudah besar.
- Di mobile perlu keputusan tumpuk/`Sheet` → kerja tambahan, risiko regresi a11y (fokus, escape).
- Perlu `hover-card`/layout split baru; menghabiskan lebar yang saat ini dipakai dua section berdampingan (sebenarnya `flex-col`).

### Opsi C — Media grid

Kartu grid cover dengan overlay badge.

**Desktop:**

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ ▣ Member     │ │ ▣ Diajukan   │ │ ▣ Publik     │
│              │ │              │ │              │
│    cover     │ │    cover     │ │    cover     │
│              │ │              │ │              │
│ ╠════════════│ │ ╠════════════│ │ ╠════════════│
│ Judul        │ │ Judul        │ │ Judul        │
│ 👤 Budi      │ │ 🏢 Org X     │ │ 👤 Publik    │
│ 📅 15 Jan    │ │ 📅 20 Jan    │ │ 📅 22 Jan    │
│ [✓ Setujui]  │ │ [✓ Setujui]  │ │ [✓ Setujui]  │
│ [✕ Tolak]    │ │ [✕ Tolak]    │ │ [✕ Tolak]    │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Mobile:** 1 kolom; `sm:grid-cols-2 xl:grid-cols-3` (reuse `CARD_GRID_CLASS`).

**Pro:**

- Paling menarik secara visual; cover besar (cocok konten bergambar).
- Familiar (mirip `DashboardArchiveCard`/`EventHighlightCard` non-admin).
- Scan visual cepat untuk item sedikit.

**Kontra:**

- **Paling boros ruang** — hanya ~2–3 item per viewport; buruk untuk antrean panjang.
- Metadata sedikit (harus dipotong agar kartu tidak melar).
- Menempatkan 2–3 antrean grid vertikal → halaman jadi sangat panjang.
- Overlay text di atas foto berisiko kontras (dark/light, foto terang).
- Aksi approve/reject di kartu besar terasa berat untuk alur kerja berkecepatan tinggi.

---

## 4. Rekomendasi

**Rekomendasi: Opsi A (Unified approval card)**, dengan **Opsi B sebagai upgrade masa depan** bila volume antrean terbukti besar.

**Alasan:**

1. **Konsistensi tertinggi dengan kode terbaru.** §10h baru saja memperkenalkan kartu media submissions; Opsi A menyatukan Events/Archives ke pola yang sama → tiga antrean jadi satu bahasa visual.
2. **Biaya implementasi minimal** (lazy): ekstraksi satu komponen presentational `ApprovalCard`, lalu event/archive/submission memakainya. Tidak ada state baru, tidak ada backend baru.
3. **Tetap dashboard.** Padat, `limit=5` + pagination tetap; tidak mengubah arsitektur `dashboard-home.tsx`.
4. **Aksesibel & responsif** mengikuti pola yang sudah terbukti di submissions (`motion-safe:`, ikon teks, `aria-busy`).
5. Opsi B/C menambah kompleksitas/ruang yang tidak sepadan sebelum ada bukti volume; YAGNI.

**Membedakan jenis tanpa field `source`** (mis. satu komponen dipakai berulang):

| Antrean | Judul section (sudah ada) | Ikon header/leading | Badge jenis | Sumber status | Aksen |
| --- | --- | --- | --- | --- | --- |
| **Event member** | `section.pendingEvents.title` | `CalendarDays` | `Diajukan` (`event:statusOptions.REQUEST`), `variant="secondary"` | `event:statusOptions.REQUEST` | netral |
| **Arsip member** | `section.pendingArchives.title` | `FolderArchive` | `Member` (`archive:typeOptions.MEMBER`), `variant="outline"` + `Lock`/`Users` | `archive:statusOptions.REQUEST` | `bg-primary/10 text-primary` (chip) |
| **Submission publik** | `section.pendingSubmissions.title` | `Globe`/`Building2` | `Diajukan` (`pendingSubmission.statusRequest`), `variant="secondary"` | — | netral |

Aturan eksplisit: **jenis dibedakan oleh kombinasi ikon + teks label + judul section**, bukan warna saja (WCAG 1.4.1 use of color). Aksen warna hanya memperkuat, bukan satu-satunya sinyal.

Alasan bukan field `source`: tidak ada di response backend (event/archive tidak punya kolom sumber), dan informasi “antrean mana” sudah tersedia dari section yang merender komponen. Menandai source di kartu akan menambah state tanpa nilai.

---

## 5. Spesifikasi Implementasi (tanpa kode)

### 5.1 Komponen

**Dibuat:**

- `src/features/dashboard/components/approval-card.tsx` — **presentational murni** (hanya `components/ui`, `lib`, `i18n`; tanpa import lintas domain). Kartu media seragam. Dipakai ketiga antrean.
  - `interface ApprovalCardProps`:
    - `id: string`
    - `title: string`
    - `thumbnail: string | null`
    - `statusLabel: string`
    - `statusVariant?: 'default' | 'secondary' | 'outline' | 'destructive'`
    - `kindBadge?: { label: string; variant: 'default' | 'secondary' | 'outline' }` — label jenis (`Member`, dll)
    - `kindIcon?: LucideIcon` — ikon leading judul/identitas
    - `creator?: { name: string; network?: string | null }` (event) atau `creatorName?: string` (arsip)
    - `dateLabel?: string | null`
    - `locationName?: string | null`
    - `categories?: string[]`
    - `description?: string | null`
    - `canApprove: boolean`, `canReject: boolean`, `showViewDetail?: boolean`
    - `busy?: boolean`, `actionsDisabled: boolean`
    - `onViewDetail?`, `onApprove`, `onReject`
    - `className?: string`
  - State internal: loading (`Skeleton`), empty/error (muted) — atau state dipertahankan di komponen queue (lihat 5.2).

**Diubah:**

- `dashboard-pending-events.tsx` — render `ApprovalCard` per item; tambah metadata organisasi/lokasi/tipe.
- `dashboard-pending-archives.tsx` — render `ApprovalCard`; tampilkan kategori/deskripsi + badge `Member`.
- `dashboard-pending-submissions.tsx` — migrasi ke `ApprovalCard` (tanpa regresi; submissions tanpa “Lihat detail”).
- `dashboard-home.tsx` — mapping view type bertambah; query arsip pending tambah `type: 'MEMBER'`; ikon section.

**Shadcn yang perlu:** **tidak ada baru**. `badge`, `button`, `card`, `skeleton` sudah terpasang. (`tooltip`, `separator` sudah ada bila diperlukan.) Opsi B (masa depan) butuh `scroll-area` via CLI; **tidak** untuk Opsi A.

### 5.2 View type (`features/dashboard/types.ts`)

```ts
// Perubahan DashboardPendingEventItem — tambah konteks konten
export interface DashboardPendingEventItem {
  id: string
  name: string
  thumbnail: string | null
  creatorName: string | null          // organisasi event ?? creator.network ?? fullName
  dateLabel: string | null
  locationName: string | null         // BARU — event.location?.name
  eventTypes: string[]                // BARU — eventTypes.map(t => t.name)
}

// Perubahan DashboardPendingArchiveItem — tambah type + tanggal
export interface DashboardPendingArchiveItem {
  id: string
  name: string
  thumbnail: string | null
  creatorName: string | null
  description: string | null
  categories: string[]
  type: DashboardArchiveType          // BARU — 'MEMBER' | 'PUBLIC'
  dateLabel: string | null            // BARU — formatDate(updatedAt) sbg proxy "diajukan"
}
```

`DashboardPendingSubmissionItem` **tidak berubah**.

### 5.3 Query / filter endpoint

| Antrean | Endpoint | Perubahan |
| --- | --- | --- |
| Pending Events | `GET /events?page=<n>&limit=5&filter[status]=REQUEST` | **tidak berubah** |
| Pending Archives | `GET /archives?page=<n>&limit=5&filter[status]=REQUEST&filter[type]=MEMBER` | **tambah `filter[type]=MEMBER`** |
| Pending Submissions | `GET /event-submissions?page=<n>&limit=5&filter[status]=REQUEST` | tidak berubah |

**Verifikasi `filter[type]` — DIDUKUNG, tanpa perubahan backend.** Bukti:

- `ARCHIVE_FILTER_FIELDS = ['type', 'status', 'publishedAt', 'createdAt', 'updatedAt']` (archive.md §8) — `type` di whitelist.
- `type` enum filter = `['MEMBER', 'PUBLIC']`.
- FE sudah generik: `ListArchivesParams.filter?: Record<string, string>` → diserialisasi `filter[<key>]=<value>` (`archive/api/archives.ts`), dan `useArchives` meneruskan `filter` ke queryKey + queryFn.
- Contoh resmi backend: `GET /api/v1/archives?filter[type]=MEMBER&filter[status]=PUBLISHED` (archive.md §8).

Implementasi route: ubah `filter: { status: 'REQUEST' }` → `filter: { status: 'REQUEST', type: 'MEMBER' }` pada `pendingArchivesQuery`.

> **Catatan penting:** `filter[type]=MEMBER` menyaring arsip yang **ber-visibilitas member-only**, bukan "dibuat oleh member". Lihat §7 risiko.

### 5.4 i18n (namespace `dashboard`, `en`/`id`)

Key **baru** (diusulkan) di `dashboard.json`:

- `approval.member` — label badge jenis: "Member" / "Member".
- `approval.organizer` — "Penyelenggara" / "Organizer".
- `approval.location` — "Lokasi" / "Location".
- `approval.categories` — "Kategori" / "Categories".
- `approval.date` — "Tanggal" / "Date".
- `approval.viewDetail` — reuse `pending.viewDetail` (sudah ada).

Key **diubah**:

- `section.pendingEvents.subtitle` — sebut “member & organisasi” (sudah).
- `section.pendingArchives.subtitle` — perjelas “arsip khusus member”. Contoh: `"Arsip member-only yang menunggu persetujuan."`
- `section.pendingSubmissions.title` — konsisten "Usulan Event Menunggu Review" (sudah di id).

Key **reuse**: `pending.{approve,reject,viewDetail,unknown}`, `pendingSubmission.statusRequest`, `event:statusOptions.REQUEST`, `archive:statusOptions.REQUEST`, `archive:typeOptions.MEMBER`, `common:eventCard.noThumbnail`.

Update **en & id** bersamaan.

### 5.5 Perilaku & a11y

- `busy` per item (`busyId === item.id`) + `actionsDisabled = busy || isRefreshing` dipertahankan; `aria-busy` di tombol item terproses.
- Clamp halaman (`useEffect`) tetap; `DataTablePagination` tetap dirender setelah kartu.
- Loading → 3× skeleton kartu (tinggi setara); empty/error → pesan muted `section.pending*.{empty,error}` (pola existing).
- Hover lift dibungkus `motion-safe:` (submissions sudah begitu, archive/story belum — samakan).

---

## 6. Data yang Ditampilkan (pemetaan field backend nyata)

### Event (`GET /events`, scope `all` → `EventResponse` — event.md §3)

| Field response | Elemen visual | Tersedia? |
| --- | --- | --- |
| `name` | Judul kartu | ✅ |
| `thumbnail` | Media 16:9 + fallback `ImageOff` | ✅ |
| `creator.fullName` | Baris pengaju | ✅ |
| `creator.network.name` | Baris “organisasi penyelenggara” (fallback) — **satu-satunya yang di-declare di FE `Event` saat ini** | ✅ |
| `network.name` (top-level) | Baris organisasi utama (precedence event.md §3) | ⚠️ ada di response backend, **belum dideklarasikan di `features/event/types.ts` `Event`** — tambah field bila mau precedence penuh |
| `dates[]` (`date`/`startTime`/`endTime`) | `dateLabel` (`formatEventDate`) | ✅ |
| `location.name` | Baris lokasi (`MapPin`) | ✅ |
| `eventTypes[].name` | Chip tipe | ✅ |
| `status` | Badge “Diajukan” (label i18n, bukan raw) | ✅ |
| `content` | — (tidak ditampilkan; bisa jadi deskripsi masa depan) | ⚠️ ada, tak dipakai |
| “sumber = member” | Ikon/badge jenis event | ❌ **tidak ada field** |

Precedence pengaju (event.md §3): `event.network?.name ?? event.creator?.network?.name ?? event.creator?.fullName ?? '—'`. Catatan: FE `Event` **belum** punya `network` top-level (hanya `creator.network`) — mapping existing di `dashboard-home.tsx` memakai `creator.network?.name ?? creator.fullName`. Untuk precedence penuh, tambah `network` ke `features/event/types.ts` (bukan tugas dokumen ini). Untuk membedakan baris “organisasi” vs “individu”, tampilkan ikon `Building2` bila organisasi ada, `User` bila hanya `fullName` — **inferensi**, bukan fakta.

### Archive (`GET /archives` → `ArchiveListItem` — archive.md §3/§12)

| Field response | Elemen visual | Tersedia? |
| --- | --- | --- |
| `name` | Judul kartu | ✅ |
| `thumbnail` | Media 16:9 + fallback | ✅ |
| `description` | Baris deskripsi (`line-clamp-2`) | ✅ |
| `categories[].name` | Chip kategori | ✅ |
| `type` (`MEMBER`/`PUBLIC`) | Badge jenis (`archive:typeOptions.*`) | ✅ |
| `creator.fullName` | Baris pengaju | ✅ |
| `createdAt` / `updatedAt` | `dateLabel` (proxy “diajukan”) | ✅ |
| `status` | Badge “Diajukan” | ✅ |
| `creator.network` | Baris organisasi pengaju | ❌ **di-strip dari response** (archive.md §3: `creator = { id, fullName }`) |
| `submittedAt` (tanggal pengajuan) | Tanggal pengajuan asli | ❌ **tidak ada** — pakai `updatedAt` |
| `externalLinks` / `documents` | Ringkasan berkas | ❌ hanya di detail; `MEMBER` + tanpa akses → `null` |

### Submission (`GET /event-submissions` → `DashboardPendingSubmissionItem` — §10h)

| Field | Elemen | Tersedia? |
| --- | --- | --- |
| `title`, `thumbnail`, `organiser`, `country.name`, `state.name`, `startDate`/`endDate` | Kartu media | ✅ |

**Field yang belum tersedia (tandai di UI atau fallback):**

- **Event:** indikator “dari member”. → fallback: anggap seluruh antrean `REQUEST` berasal dari member/org (karena `REQUEST` = hasil `event:submit`), label section sudah menyebut “member & organisasi”.
- **Archive:** organisasi pengaju & tanggal pengajuan. → fallback: hanya `creator.fullName`, tanggal pakai `updatedAt` (`—` bila invalid).
- **Submission:** `source`/rasional pengaju. → tidak perlu (section sudah menandai publik).

---

## 7. Risiko & Catatan

1. **`filter[type]=MEMBER` ganda makna (risiko utama).** `type` di archive = **visibilitas** (`MEMBER` = member-only), **bukan** asal pengaju. Member bisa mengajukan arsip `type=PUBLIC` → arsip itu **akan hilang** dari antrean bila kita kunci `filter[type]=MEMBER`. Pilihan:
   - (a) Kunci `type=MEMBER` (sesuai permintaan “khusus member”) — menerima bahwa arsip PUBLIK dari member tidak masuk antrean ini.
   - (b) Tampilkan semua `REQUEST` (tanpa filter type) tetapi beri badge `Member`/`Publik` per kartu — lebih aman tetapi tidak memisahkan antrean.
   - (c) Dua sub-section / filter toggle “Member-only” vs “Semua”. Perlu keputusan produk. Rekomendasi sementara: **(a) + catat backlog** bahwa “arsip member-authored” tidak dapat dibedakan tanpa field baru (`createdByRole`/`source`).
2. **Event member tanpa organisasi.** Member sering tanpa `networkId` → hanya `creator.fullName`. Kartu harus tampil baik tanpa baris organisasi. Jangan mengarang nama organisasi.
3. **Event internal vs member tak terbeda.** Admin juga punya `event:submit`; event internal ber-`REQUEST` bisa tercampur. Tidak ada field sumber → tidak bisa dipisah di FE. Judul section “Diajukan member dan organisasi” sebaiknya jangan diklaim terlalu kuat.
4. **Archive tanpa `creator.network`.** Konsisten dengan (2)); desain kartu tidak boleh bergantung padanya.
5. **Jumlah item besar.** Kartu lebih tinggi dari baris. `limit=5` + pagination menahan tinggi; jangan naikkan limit di grid. Pantau performa `img` banyak → tambah `loading="lazy"` (submissions sudah).
6. **Gate terpisah.** `isArchiveModerator` (`archive:approve/reject`) independen `isAdmin` (`event:*`). Refactor tidak boleh mengikat render arsip ke `isAdmin`.
7. **Refactor regresi.** Mengganti tiga komponen berisiko kehilangan `busyId`/`isRefreshing`/pagination. Migrasi bertahap + verifikasi lint/tsc setiap langkah.
8. **Badge member-only “MEMBER”.** Jangan pakai istilah yang bisa disalahpahami (visibilitas vs pengaju). Gunakan label eksplisit mis. “Member-only”.

---

## 8. Rencana Bertahap

**Langkah 1 — Ekstraksi komponen (tanpa perubahan tampilan).**
Buat `approval-card.tsx`; migrasikan `dashboard-pending-submissions.tsx` ke komponen ini lebih dulu (paling dekat secara visual). Verifikasi `pnpm lint` + `pnpm tsc --noEmit` + paritas tampilan/mobile.

**Langkah 2 — Adopsi Event & Archive + data.**
Migrasikan `dashboard-pending-events.tsx` dan `dashboard-pending-archives.tsx` ke `ApprovalCard`. Tambah field view type (`locationName`, `eventTypes`; `type`, `dateLabel`). Ubah `pendingArchivesQuery` → `filter: { status: 'REQUEST', type: 'MEMBER' }`. Tambah key i18n `approval.*` (en/id).

**Langkah 3 — Polish & pemisahan jenis.**
Ikon section (`CalendarDays`/`FolderArchive`/`Globe`), badge jenis per antrean, aksen `bg-primary/10 text-primary`, `motion-safe:` konsisten, skeleton/empty/error paritas, subtitle arsip “member-only”. Uji light/dark + `prefers-reduced-motion` + keyboard focus.

**Backlog (opsional, jangan sekarang):** Opsi B master–detail bila volume antrean besar; field backend `source`/`createdByRole` agar pemisahan event member vs internal dan arsip member-authored akurat.

---

## Lampiran — File yang Perlu Diubah Saat Implementasi

| File | Aksi |
| --- | --- |
| `frontend/src/features/dashboard/components/approval-card.tsx` | **buat baru** (presentational) |
| `frontend/src/features/dashboard/components/dashboard-pending-events.tsx` | ubah — pakai `ApprovalCard` + metadata |
| `frontend/src/features/dashboard/components/dashboard-pending-archives.tsx` | ubah — pakai `ApprovalCard` + badge jenis |
| `frontend/src/features/dashboard/components/dashboard-pending-submissions.tsx` | ubah — migrasi ke `ApprovalCard` |
| `frontend/src/features/dashboard/types.ts` | ubah — `DashboardPendingEventItem`, `DashboardPendingArchiveItem` |
| `frontend/src/app/routes/dashboard-home.tsx` | ubah — mapping + query arsip `type=MEMBER` + ikon |
| `frontend/src/i18n/locales/id/dashboard.json` | ubah — key `approval.*`, subtitle arsip |
| `frontend/src/i18n/locales/en/dashboard.json` | ubah — paritas key |
| `frontend/docs/module/dashboard.md` | ubah — catat §10b/§10f/§10h setelah implementasi |

**Tanpa perubahan backend · tanpa komponen shadcn baru · tanpa dependency baru.**
