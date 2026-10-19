# Module: Network Submission (Publik) — Brief

Dokumen ini mencatat **halaman form publik `/network/join`** pada frontend React — form **anonim (tanpa login)** untuk organisasi mendaftar ke **Network**. Mengikuti konvensi `frontend/AGENTS.md` dan meniru format brief `docs/module/network.md` + brief submission lain (`docs/module/event-submission.md`).

**Tujuan fitur**: organisasi di luar EGS mengisi **satu form publik anonim** → FE `POST /network-submissions` → backend menulis **langsung ke tabel `networks`** (`status=REQUEST`, `source=PUBLIC`) → admin meninjau lewat **modul Network** (list `GET /networks?filter[status]=REQUEST`, editor `/networks/:id/edit`, aksi `POST /networks/:id/approve|reject`; lihat `docs/module/network.md` + §13). Form **mirror field** dari proyek referensi `C:\project\european-gamelan-society\components\network\NetworkSubmissionForm.tsx` (baca-saja; **jangan** edit proyek referensi).

> **Status**: ✅ **IMPLEMENTED** — **modul submission = FORM PUBLIK SAJA**. File dibuat: `src/features/network-submission/*` (api/hooks/lib/components/types), halaman `src/app/routes/network-join.tsx`, i18n namespace `networkSubmission` (en/id), route publik `/network/join`, + key `validation:*` baru. **Review & edit admin kini lewat modul Network** (§13) — permukaan admin submission (`GET/PATCH/approve/reject /network-submissions`) dan permission `network-submission:*` **sudah dihapus** dari backend/FE.
>
> **Status rename**: initial submission `status` = **`REQUEST`** (dulu `PENDING`). Enum `REQUEST | APPROVED | REJECTED`.
>
> **Backend SUDAH ADA** — `POST /network-submissions` publik (`@Public()`). **Tidak ada** flag `ENABLE_SUBMISSION` (beda dari referensi, yang menahan submit sampai endpoint ada): di repo ini submit **selalu** `POST`.
>
> **Route publik, tanpa auth, tanpa sidebar.** Halaman standalone di luar `ProtectedRoute`/`DashboardLayout`, seperti `/login` & `/register`. Tidak ada entri sidebar, tidak ada `RequirePermission`, tidak ada login/gate permission.

## 1. Ruang Lingkup

**Termasuk:**

- Halaman publik **`/network/join`** (`app/routes/network-join.tsx`): hero + form standalone (tanpa sidebar/header dashboard).
- Form RHF + zod, **1 section**: **Organisation Details** (submitter email audit ikut di dalamnya).
- Fitur baru `src/features/network-submission/`: API + hook + schema + payload + komponen form + layar sukses + types.
- Cascade **Country → State → City** untuk `countryId`/`stateId`/`cityId` (state difetch dari `iso2` country terpilih; `cityId` opsional, difetch via `useCities({ countryId, stateId })`; ganti country/state reset turunannya).
- **Submitter audit email-only**: field `submitter.email` (wajib) tampil full-width tepat di bawah `ledBy`; tanpa nama/negara/state pengirim.
- Daftar **`socialMedia`** dinamis (platform + url, maks 10, tambah/hapus; baris kosong di-strip).
- Handling error terpetakan: 422 per-field, 429 rate-limit, 500/network generik. Sukses → **layar terima kasih** (tanpa navigasi keluar).
- i18n namespace baru `networkSubmission` (en/id) + key `validation:*` baru.

**Tidak termasuk:**

- Permukaan admin submission di modul ini — **dihapus**. Review & edit usulan dilakukan lewat **modul Network** (`GET /networks?filter[status]=REQUEST`, `/networks/:id/edit`, `POST /networks/:id/approve|reject`) — lihat §13 + `docs/module/network.md`.
- Login/registrasi/akun submitter — form **anonim**; `submitter` hanya audit (tidak membuat `User`).
- Upload file/gambar/thumbnail publik.
- Rich text editor untuk `content` — pakai `Textarea` biasa (mirror referensi); server men-sanitasi `content`.
- Perubahan backend apa pun — endpoint sudah final; **jangan** edit `backend/`.

## 2. Routing & Permukaan UI

- Route publik top-level `/network/join` (`app/routes/network-join.tsx`), didaftarkan di `src/app/routes/index.tsx` **sebelum** fallback `*` (`{ path: '*', element: <Navigate to="/" replace /> }`), di luar blok `/` protected.
- **Tanpa** `ProtectedRoute`/`GuestRoute`/`DashboardLayout`; halaman **standalone** (hero + form), tanpa sidebar/header dashboard. Pola sejajar `path: '/login'` & `path: '/register'`.
- **Tidak ada entri sidebar** (bukan menu dashboard), **tidak ada gate** `RequirePermission`.
- Bahasa/theme toggle opsional di hero lewat shared `components/shared/language-switcher` (bila dipakai) — murni presentational.

```
/network/join   → halaman publik (hero + form + layar sukses)  — tanpa auth, tanpa permission
```

- **Tidak ada route admin** di modul ini. Review & koreksi usulan dilakukan lewat **modul Network**: list `GET /networks?filter[status]=REQUEST`, editor `/networks/:id/edit`, aksi `POST /networks/:id/approve|reject` (§13). Form `/network/join` serta layar sukses tak berubah.

## 3. Struktur Folder

```
src/features/network-submission/
├── api/
│   └── network-submissions.ts                  # createNetworkSubmission(payload): Promise<NetworkSubmissionResult> via request
├── hooks/
│   └── use-create-network-submission.ts        # useMutation(createNetworkSubmission)
├── lib/
│   ├── schema.ts                               # createNetworkSubmissionSchema(t) zod + NetworkSubmissionFormValues + EMPTY; re-export konstanta dari network/lib/constants
│   └── payload.ts                              # buildNetworkSubmissionPayload(values) — strip baris sosial kosong, buang opsional kosong
├── components/
│   ├── network-submission-form.tsx             # RHF+zod, 1 section (Organisation Details) + cascade Country→State→City
│   └── network-submission-success.tsx          # layar terima kasih
└── types.ts                                    # NetworkOrganisationType, NetworkSubmissionSocialMedia, NetworkSubmissionSubmitter, CreateNetworkSubmissionInput, NetworkSubmissionResult

src/app/routes/network-join.tsx                 # halaman publik: hero + form (standalone)
```

- **Konsumen**: hanya halaman `src/app/routes/network-join.tsx` (container) yang import hook + komponen fitur. Halaman pegang state `submitted`; form presentational + callbacks.
- Komponen shared dipakai ulang (tidak dibuat baru): `components/ui/{form,input,textarea,select,button,label,card,badge}`; `components/shared/search-select` (country/state); `components/shared/language-switcher` (opsional hero).
- **Tidak ada** `app/routes/network-submissions.tsx` (admin), tabel/list submission mandiri, route edit submission, maupun permukaan API admin submission — semuanya **dihapus**. Review & edit usulan lewat **modul Network** (§13).
- **Review admin (modul Network, lihat §13)**: list `features/network/hooks/use-networks.ts` (`useNetworks({ filter: { status: 'REQUEST' } })`) → `GET /networks`, aksi `use-approve-network.ts`/`use-reject-network.ts` → `POST /networks/:id/approve|reject`, editor `/networks/:id/edit`, komponen presentational `features/dashboard/components/dashboard-pending-network-submissions.tsx`, view type `DashboardPendingNetworkSubmissionItem`.
- Reuse infra existing: `lib/api-client.ts` (`request`, `ApiError`, `isValidationError`), `lib/field-errors.ts` (`mapApiFieldErrors`), `lib/toast.ts` (`toastSuccess`/`toastError`/`getApiErrorMessage`), `features/geo/api/geo.ts` (`listCountries`, `listStatesByCountry`), `features/geo/hooks/use-countries.ts` (`useCountries`), `features/geo/hooks/use-states.ts` (`useStates(iso2)`), `features/geo/hooks/use-cities.ts` (`useCities({ countryId, stateId })`).

## 4. Kontrak API

Prefix global `/api/v1`. Envelope: sukses `{ data, message }`; error `{ statusCode, message, errors }`. Unwrap sekali di `lib/api-client.ts` (`request` → `body.data`). Endpoint **PUBLIC** — `request` melampirkan Bearer **hanya bila token ada**; jalan tanpa token.

| Metode | Endpoint | Body | Keterangan |
| --- | --- | --- | --- |
| POST | `/network-submissions` | `CreateNetworkSubmissionDto` (lihat bawah) | **Publik** (`@Public()`); **201**; respons `{ data: { id, status }, message }`; menulis **langsung ke tabel `networks`** dengan `status = REQUEST` + `source = PUBLIC` (id = id network). Rate-limit **5 req/menit per IP** → **429**. Body whitelist (`additionalProperties:false`) → field tak dikenal **422**. Error yang mungkin: **422** `{ statusCode, message: 'Validation failed', errors: [{ field, message }] }` (validasi per-field), **429** (rate-limit), **500/network** (generik). **Tidak ada** duplikat 409. |

`CreateNetworkSubmissionDto` (mirror DTO backend `backend/libs/src/modules/network/dto/create-public-network.dto.ts`):

| Field | Tipe | Aturan |
| --- | --- | --- |
| `organisationType` | enum | **wajib** — `GAMELAN_GROUP` \| `ASSOCIATION` \| `INSTITUTION` |
| `name` | string | **wajib** — 1–200 |
| `ledBy` | string | opsional — ≤200 |
| `countryId` | int | **wajib** |
| `stateId` | int | opsional — **harus milik `countryId`** |
| `cityId` | int | opsional — kota untuk `countryId`/`stateId` terpilih |
| `address` | string | ≤500 |
| `mapsUrl` | uri | ≤2048 |
| `website` | uri | ≤500 |
| `contact` | string | opsional — email **atau** nomor telepon 7–15 digit, `^(?:[^\s@]+@[^\s@]+\.[^\s@]{2,}\|\+?\d{7,15})$`, ≤200 |
| `socialMedia` | array | `{ platform(1–50), url(uri ≤500) }[]`, **maks 10** |
| `activityType` | string | ≤100 (opsional) |
| `content` | string | **wajib** — 1–10000; rich HTML, **disanitasi server** (`sanitizeStoryContent`); plain text aman |
| `submitter` | object | **wajib** (audit-only) — `{ email }` saja |

Tipe (`types.ts`):

```typescript
export type NetworkOrganisationType = 'GAMELAN_GROUP' | 'ASSOCIATION' | 'INSTITUTION'

export interface NetworkSubmissionSocialMedia {
  platform: string
  url: string
}

export interface NetworkSubmissionSubmitter {
  email: string
}

export interface CreateNetworkSubmissionInput {
  organisationType: NetworkOrganisationType
  name: string
  ledBy?: string
  countryId: number
  stateId?: number
  cityId?: number
  address?: string
  mapsUrl?: string
  website?: string
  contact?: string
  socialMedia?: NetworkSubmissionSocialMedia[]
  activityType?: string
  content: string
  submitter: NetworkSubmissionSubmitter
}

export interface NetworkSubmissionResult {
  id: string
  status: string   // 'REQUEST'
}
```

`api/network-submissions.ts`:

```typescript
export function createNetworkSubmission(
  payload: CreateNetworkSubmissionInput,
): Promise<NetworkSubmissionResult> {
  return request<NetworkSubmissionResult>('/network-submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
```

## 5. Aturan Validasi (zod, mirror DTO)

- Schema `createNetworkSubmissionSchema(t)` di `lib/schema.ts`, dibungkus `useMemo(..., [t])`; pesan **hanya** dari `t('validation:*')`. Field string wajib `trim` + batas panjang **mirror DTO**.
- **Geo disimpan sebagai string id numerik** di form (`countryId`/`stateId`/`cityId` → string), dikonversi ke `number` saat submit (`buildNetworkSubmissionPayload`). Ganti country → reset state + city; ganti state → reset city.
- **Buang opsional kosong** saat submit (`buildNetworkSubmissionPayload`): jangan kirim `undefined`/string kosong untuk `ledBy`/`stateId`/`cityId`/`address`/`mapsUrl`/`website`/`socialMedia`/`activityType`.
- **`contact`** opsional: email **atau** telepon, regex `^(?:[^\s@]+@[^\s@]+\.[^\s@]{2,}|\+?\d{7,15})$` (input `type="text"`, tanpa `inputMode="tel"`), pesan `validation:contactInvalid`.
- **`socialMedia`**: `useFieldArray` (platform + url). Baris **penuh kosong di-strip** sebelum submit (jika hasil kosong → omit field). Baris terisi wajib lengkap (superRefine zod → pesan per-field via `<FormMessage />`). Maks **10**.
- **`activityType`** Select; nilai `OTHER` → tampil `Input` deskripsi bebas (wajib bila dipilih, ≤100) yang dipetakan jadi nilai `activityType` (mirror referensi). Opsi mirror referensi: `Gamelan Ensemble` / `Dance Group` / `Theatre / Drama Group` / `Music Group` / `Education / Workshop` / `Research / Academic` / `Cultural Institution` / `OTHER` (disimpan apa adanya; label i18n).
- 422 dari server → `mapApiFieldErrors` → `form.setError` per-field (tanpa toast). `KNOWN_FIELDS`/field path server (`cityId`, `submitter.email`, `socialMedia.N.url`, dst.) dipetakan; error tak-terpetakan → banner generik.

**Key `validation:*` baru** (tambah ke `src/i18n/locales/{en,id}/validation.json`; sisanya reuse existing `nameRequired/nameMax/emailRequired/emailInvalid/emailMax/addressMax/websiteMax/contactMax/contentMax/descriptionMax/socialPlatformRequired/socialPlatformMax/socialUrlRequired/socialUrlMax/socialMediaMax`):

```
organisationTypeRequired, organisationTypeInvalid,
countryRequired,
activityTypeMax, activityTypeOtherRequired, ledByMax,
mapsUrlMax, mapsUrlInvalid, websiteInvalid,
socialUrlInvalid, contentRequired
```

## 6. Aksi / Flow

1. User buka `/network/join` (anonim). Hero + form 1 section.
2. Isi form; cascade Country→State→City via `useCountries` + `useStates(iso2)` (`iso2 = countries.find(c => String(c.id) === countryId)?.iso2`) + `useCities({ countryId, stateId })`. State select `disabled` bila country belum dipilih; city select `disabled` bila state belum dipilih. Ganti country → reset state + city; ganti state → reset city.
3. Submit → validasi zod client → `buildNetworkSubmissionPayload(values)` → `useCreateNetworkSubmission().mutate(payload)` → `POST /network-submissions`.
4. Call-site (`network-join.tsx`) `onSuccess` → `toastSuccess(t('networkSubmission:success.toast'))` + **set state `submitted` → render `NetworkSubmissionSuccess`** (layar terima kasih; **tanpa** navigasi keluar).
5. Banner error (`network-submission-form.tsx`; banner **hanya non-422**):
   - **422** → `if (isValidationError(err)) return;` → `mapApiFieldErrors` → `form.setError` per-field (tanpa toast/banner).
   - **429** → banner rate-limit (`errors.rateLimited`).
   - **500 / non-`ApiError`** (mis. fetch gagal/`TypeError`) → banner generik (`errors.generic`).
6. Hook `useCreateNetworkSubmission` = `useMutation(createNetworkSubmission)` **(tanpa invalidate** — tidak ada list publik; boleh no-invalidate).

**`buildNetworkSubmissionPayload(values)`** (`lib/payload.ts`): konversi `countryId`/`stateId`/`cityId` → `Number`; `stateId`/`cityId` hanya bila terisi; `submitter` **hanya** `{ email }`; strip baris `socialMedia` kosong; omit opsional kosong; `activityType` OTHER → teks bebas. Tidak ada flag `ENABLE_SUBMISSION`.

```tsx
// network-join.tsx (rencana) — call-site
createNetworkSubmission.mutate(buildNetworkSubmissionPayload(values), {
  onSuccess: () => setSubmitted(true),
  onError: (err: unknown) => {
    if (isValidationError(err)) {
      for (const [field, message] of Object.entries(mapApiFieldErrors(err))) {
        form.setError(field as keyof NetworkSubmissionFormValues, { message })
      }
      return
    }
    setBanner(getApiErrorMessage(err, t('networkSubmission:errors.generic')))
  },
})
```

## 7. i18n

- **Namespace baru `networkSubmission`** — locale `src/i18n/locales/{en,id}/networkSubmission.json`; daftarkan di `src/i18n/index.ts` (`import`, `resources.en/id`, dan array `ns`).
- Struktur key utama:

  - `hero.{title,subtitle,badge?}` — hero halaman publik.
  - `section.organisation` — judul section.
  - `form.organisationType.{label,placeholder}`, `form.organisationType.options.{GAMELAN_GROUP,ASSOCIATION,INSTITUTION}`.
  - `form.name.{label,placeholder}`, `form.ledBy.{label,placeholder}`, `form.country.{label,placeholder}`, `form.state.{label,placeholder}`, `form.city.{label,placeholder}`, `form.address.{label,placeholder}`, `form.mapsUrl.{label,placeholder}`, `form.website.{label,placeholder}`, `form.contact.{label,placeholder}`.
  - `form.socialMedia.{label,platform,url,add,remove,platformAria,urlAria}`.
  - `form.stateSelectCountry` — placeholder state saat country belum dipilih; `form.citySelectState` — placeholder city saat state belum dipilih.
  - `form.activityType.{label,placeholder,options.*,otherLabel,otherPlaceholder}`.
  - `form.content.{label,placeholder}`.
  - `form.submitter.email.{label,placeholder}` (satu-satunya field submitter).
  - `actions.{submit,submitting}`.
  - `errors.{rateLimited,generic}`.
  - `success.{title,message,toast}`.
  - `search.*` (placeholder combobox `SearchSelect`: `placeholder`, `searchPlaceholder`, `emptyLabel`).

- Key `validation:*` baru: lihat §5. **Tidak ada** namespace `network` yang diubah.

## 8. Desain

Mengikuti `docs/DESIGN_SYSTEM.md` (token, tanpa hardcode warna/radius; `cn()` dari `@/lib/utils`). Standalone tanpa sidebar — hero + kartu form, responsif (`sm:grid-cols-2` untuk pasangan field, 1 kolom di mobile).

- Field organisasi (urutan final): `organisationType` (Select) → `name` (Input) → `ledBy` (Input) → `submitter.email` (Input email, full-width) → `country`+`state` (SearchSelect, 2 kolom) → `city` (SearchSelect, full-width, opsional) → `address` (Input) → `mapsUrl` (Input url) → `website`+`contact` (Input url + Input teks email/telepon opsional, 2 kolom) → `socialMedia` (field array) → `activityType` (Select; `OTHER` → Input deskripsi) → `content` (Textarea).
- **Tidak ada** section/card "Submitted By" — field submitter audit direduksi menjadi email saja di dalam Organisation Details.
- Tombol submit `Button` `disabled` saat `isPending` + label `actions.submitting` (`aria-busy`).
- Banner error (`role="alert"`) di atas tombol submit — **hanya non-422**; 422 per-field via `<FormMessage />` kosong.
- Layar sukses (`network-submission-success.tsx`): ikon centang + `success.title` + `success.message`; presentational, terima props/teks.
- **Aksesibel**: semua field ber-`label`; error ter-assosiasi via `FormMessage`; tombol hapus baris sosial `aria-label`; Select platform/url sosial `aria-label` bernomor.

## 9. Permissions

- **Halaman publik & endpoint create**: tidak ada permission — route **publik**, endpoint **publik** (`@Public()`). Tanpa `RequirePermission` di `/network/join`; tanpa cek `can()` di komponen form.
- **Review & edit usulan (modul Network, §13)**: gate permission **`network:read`** (list `GET /networks?filter[status]=REQUEST`), `network:approve` (tombol Setujui), `network:reject` (tombol Tolak), `network:update` (editor `/networks/:id/edit`). Permission `network-submission:*` **tidak ada lagi**.
- **Tidak ada** entri sidebar untuk submission (form publik standalone; review lewat editor Network + section dashboard).

## 10. Acceptance Criteria

- [ ] `/network/join` dapat diakses **tanpa login**; tidak di-redirect ke `/login`.
- [ ] Route didaftarkan **sebelum** fallback `*`; halaman standalone (tanpa sidebar dashboard).
- [ ] Field form **lengkap** sesuai §4/§8 (semua field DTO `CreateNetworkSubmissionDto` terwakili).
- [ ] Cascade Country→State→City berfungsi: ganti country reset state + city; ganti state reset city; state `disabled` sebelum country dipilih; city `disabled` sebelum state dipilih.
- [ ] `cityId` opsional (tidak wajib) — kosong → tidak dikirim.
- [ ] `socialMedia` dinamis: tambah/hapus, maks 10, baris kosong di-strip; baris terisi wajib lengkap.
- [ ] `activityType = OTHER` → Input deskripsi bebas wajib; nilai terkirim = deskripsi.
- [ ] Submit → `POST /network-submissions`; **201** → layar terima kasih (tanpa navigasi).
- [ ] **422** → error per-field via `form.setError`/`<FormMessage />`, tanpa toast/banner.
- [ ] **429** → banner rate-limit; **500/network** → banner generik.
- [ ] Geo dikirim sebagai `number`; opsional kosong **tidak** dikirim; `submitter` hanya `{ email }`; `socialMedia` kosong → omit.
- [ ] Tidak ada `ENABLE_SUBMISSION`; submit selalu `POST`.
- [ ] i18n `networkSubmission` terdaftar en/id; key `validation:*` baru ada; tanpa string hardcode.
- [ ] **Review admin** (§13): section "Network Submissions Awaiting Approval" dirender di dashboard home hanya bila `can('network:read')`; query `useNetworks({ filter: { status: 'REQUEST' } })`; tombol Setujui/Tolak ter-gate `network:approve`/`network:reject`; approve `POST /networks/:id/approve` (tanpa `publishedAt`/dialog) + reject `POST /networks/:id/reject` → toast `network:toast.*` + invalidate `['network']`; tombol Edit (gate `network:update`) → `/networks/:id/edit`.

## 11. Verifikasi

Hasil aktual:

- `pnpm lint` → **0 error** (9 warning pre-existing).
- `pnpm exec tsc -p tsconfig.app.json --noEmit` → **0 error baru** (2 error pre-existing di `event-detail.tsx`/`story-detail.tsx`; catatan: `pnpm tsc --noEmit` **no-op** karena `tsconfig.json` `files: []`).
- `pnpm dev` → buka `/network/join` tanpa login; isi + submit; cek 201 → layar sukses.
- Cek manual error: 422 (field salah) per-field; spam >5/menit → 429 banner; matikan backend → banner generik.
- Cek cascade: pilih country → state terisi; pilih state → city terisi; ganti country/state → turunan reset.
- Pastikan **tidak ada** section "Submitted By" dan **tidak** ada perubahan `backend/`.

## 12. Catatan

- **Kontrak backend (sudah diterapkan).** `POST /network-submissions` publik, 201, `REQUEST`, rate-limit 5/menit, whitelist body; body menerima `cityId` opsional dan `submitter` **hanya** `{ email }`; error **422** per-field (`cityId`, `submitter.email`) / **429** rate-limit / **500/network** — tanpa duplikat 409. Rujuk `backend/apps/app/src/controllers/network-submissions.controller.ts` dan `backend/libs/src/modules/network/network.service.ts` (`createPublicSubmission`) untuk detail kontrak aktual; **jangan** edit `backend/`.
- **Beda dari referensi**: referensi memakai `ENABLE_SUBMISSION = false` (menahan submit); repo ini **tidak** — submit selalu `POST` karena endpoint sudah final.
- **Route publik tidak muncul di sidebar**: `/network/join` di luar `DashboardLayout`; tanpa menu, tanpa gate permission.
- **`submitter` audit-only**: tidak membuat `User`/akun; hanya email pelapor.
- **`content` plain text aman**: di-render sebagai teks/label; server men-sanitasi (`sanitizeStoryContent`). Form memakai `Textarea` (bukan rich text editor).
- **Mirror field (dengan deviasi)**: field diambil dari `NetworkSubmissionForm.tsx` referensi (baca-saja; **tidak** diedit), **kecuali**: submitter direduksi jadi email saja (tanpa nama/negara/state, tanpa card "Submitted By") dan ditambah `cityId` opsional (cascade setelah country/state).

## 13. Review & Edit Admin (Modul Network)

Review dan koreksi usulan Network **tidak lagi** berupa permukaan `network-submission` — submission publik menulis langsung ke tabel `networks` (`status=REQUEST`, `source=PUBLIC`), sehingga seluruh pengelolaannya memakai **modul Network** (`docs/module/network.md`). Tidak ada route/permission `network-submission:*`.

### Permukaan

- **List** `/networks` (`app/routes/networks.tsx` → `NetworkTable`, gate `network:read`) — usulan berstatus `REQUEST` muncul sebagai baris biasa; filter status via `useNetworks({ filter: { status: 'REQUEST' } })` → `GET /networks?page=<n>&limit=<n>&filter[status]=REQUEST`.
- **Editor** `/networks/:id/edit` (`app/routes/network-edit.tsx` → `NetworkForm`, gate `network:update`) — koreksi isi usulan (`PATCH /networks/:id`).
- **Aksi review**: `POST /networks/:id/approve` (permission `network:approve`, body opsional `{ publishedAt? }`) dan `POST /networks/:id/reject` (`network:reject`).

### Section dashboard "Network Submissions Awaiting Approval"

Section moderator di dashboard home (`src/app/routes/dashboard-home.tsx`) — satu kolom, dirender setelah Pending Stories, hanya bila `canReadNetworks = can('network:read')`.

- Komponen presentational `features/dashboard/components/dashboard-pending-network-submissions.tsx` (`DashboardPendingNetworkSubmissions`): props `items, isPending, isError, canApprove, canReject, canUpdate, isRefreshing?, onEdit(id), onApprove(id), onReject(id), busyId?, className?` (hanya `components/ui`/`lib`/`i18n`; **tanpa** import lintas domain). Tiap baris: tile placeholder `Building2` (tanpa thumbnail), nama + `Badge` `networkSubmission:statusOptions.REQUEST`, label jenis organisasi (`networkSubmission:form.organisationType.options.<type>`, fallback `dashboard:pending.unknown`), lalu `country · state · contact`; tombol **Edit** (`Pencil`, gate `canUpdate`) / **Setujui** / **Tolak**. Kosong/error → `dashboard:section.pendingNetworkSubmissions.{empty,error}`.
- View type dashboard-local `DashboardPendingNetworkSubmissionItem` (`features/dashboard/types.ts`): `id`, `name`, `organisationType`, `country`, `state`, `contact`.

### Data & aksi

| Aksi | Query / Mutation | Endpoint | Permission |
| --- | --- | --- | --- |
| List menunggu review | `useNetworks({ page, limit: 5, filter: { status: 'REQUEST' }, enabled: canReadNetworks })` | `GET /networks?page=<n>&limit=5&filter[status]=REQUEST` | `network:read` |
| Edit | `navigate('/networks/' + id + '/edit')` | `PATCH /networks/:id` | `network:update` |
| Setujui | `useApproveNetwork().mutate({ id }, …)` | `POST /networks/:id/approve` (tanpa body) | `network:approve` |
| Tolak | `useRejectNetwork().mutate(id, …)` | `POST /networks/:id/reject` (tanpa body) | `network:reject` |

- **Approve TANPA dialog jadwal**: `publishedAt` opsional di-omit (tanpa `PublishScheduleDialog`) — `mutate({ id }, …)` langsung.
- State `pendingNetworkSubmissionsPage` + `DataTablePagination` (`total = query.data?.total ?? 0`, `entityName = section.pendingNetworkSubmissions.title`) + clamp halaman (pola section pending lain).
- `busyId` = `approveNetwork.variables?.id` / `rejectNetwork.variables` saat `isPending`, digabung `isRefreshing` (`query.isFetching`) untuk anti double-submit.
- Toast call-site: `network:toast.{approved,approveFailed,rejected,rejectFailed}`; 422 early-return `isValidationError`; error approve juga invalidate `['network']`.

### i18n

- `dashboard:section.pendingNetworkSubmissions.{title,subtitle,empty,error}` (en/id).
- `networkSubmission:statusOptions.{REQUEST,APPROVED,REJECTED}`, label jenis organisasi `networkSubmission:form.organisationType.options.*` (badge dashboard).
- Toast review: `network:toast.{approved,approveFailed,rejected,rejectFailed}` (en/id).
