---
description: Aturan ringkas pengembangan frontend React SPA — Vite + TypeScript, TanStack Query, shadcn/ui, React Router, konsumsi API backend/ NestJS.
---

# AGENTS.md — Aturan Ringkas Frontend React SPA

## Stack & Scope

- Stack: Vite + React + TypeScript (`strict: true`), path alias `@/*` → `src/`.
- Package manager wajib **pnpm** — larang `npm install`, `yarn`, `bun`; tambah/install deps hanya via `pnpm` (`pnpm add <pkg>`, `pnpm dlx`).
- Routing: React Router.
- Hanya konsumsi API dari `backend/`. **Larang** menulis/mengubah kode di `backend/`.
- UI: shadcn/ui. Jangan edit manual file di `src/components/ui/` — tambah lewat CLI `pnpm dlx shadcn@latest add <component>`.

## Folder Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── routes/          # definisi route React Router (createBrowserRouter)
│   │   └── providers.tsx    # QueryClientProvider + RouterProvider (setup sekali)
│   ├── components/
│   │   ├── ui/              # shadcn/ui hasil generate
│   │   └── shared/          # komponen reusable lintas fitur
│   ├── features/
│   │   └── <domain>/        # singular, contoh: payee/
│   │       ├── api/         # fungsi fetch endpoint
│   │       ├── hooks/       # usePayees, useCreatePayee (TanStack Query)
│   │       ├── components/  # komponen spesifik fitur
│   │       └── types.ts     # type/payload khusus domain
│   ├── lib/
│   │   ├── api-client.ts    # klien API + unwrap envelope backend
│   │   ├── query-client.ts  # default QueryClient (retry, staleTime)
│   │   └── utils.ts         # cn()
│   └── types/               # type shared lintas domain
└── .env                     # VITE_API_BASE_URL
```

Decision tree penempatan:
1. Spesifik satu domain + logika data → `features/<domain>/`.
2. Dipakai banyak fitur / infrastruktur → `lib/` atau `components/shared/`.
3. Route-level page → `app/routes/`, komponen colocate di fitur.
4. Type domain → `features/<domain>/types.ts`; type lintas domain → `types/`.

## TanStack Query

- Query key per domain, dimulai nama domain: `['payee']`, `['payee', { id }]`.
- Hook query di `features/<domain>/hooks/`, `queryFn` memanggil fungsi `api/` — jangan fetch langsung di komponen.
- Query options konsisten: `staleTime` default (≥30s untuk data jarang berubah), `retry: 1` untuk 4xx/5xx.
- Pagination: `placeholderData: keepPreviousData`.
- List CRUD wajib sertakan `search/sortBy/sortOrder` di queryKey: `['users', { page, limit, search, sortBy, sortOrder }]` (lihat seksi List CRUD di bawah).

## List CRUD: Search Bar + Order-By (wajib setiap menu)

Setiap menu CRUD list **wajib** punya satu search bar global + order-by di semua kolom tampil (server-side, kontrak backend `docs/RULES.md` Bab 19/19a/19b):

- **Search bar**: komponen `components/shared/search-bar.tsx` di atas tabel (`placeholder` per menu, mis. "Cari nama atau email..."). State `search` di page, debounce via `hooks/use-debounced-value.ts` (300–500ms), kirim ke API hanya bila trim ≥2 char (helper `lib/list-params.ts:appendListParams`). `search` berubah → `setPage(1)`. Tombol `X` clear + empty state bedakan "Belum ada data" vs `Tidak ditemukan untuk "<search>" + tombol Reset`.
- **Order-by**: semua `TableHead` kolom tampil (kecuali `Aksi`) memakai `components/shared/sortable-header.tsx` (`Button ghost` + ikon `ArrowUpDown/ArrowUp/ArrowDown` lucide, `aria-sort` + `aria-label="Urutkan berdasarkan <Kolom>"`). Klik cycle `asc → desc → null` via `lib/list-params.ts:nextSort` (null = default backend `createdAt desc`); `sort` berubah → `setPage(1)`.
- **Wiring**: page (`app/routes/<domain>.tsx`) pegang `page/search/sortBy/sortOrder`; `features/<domain>/api/*` serialisasi via `appendListParams`; `hooks/use-*.ts` teruskan param + masukkan ke queryKey + `placeholderData: keepPreviousData`; `components/*-table.tsx` presentational (`sortBy/sortOrder/onSort/searchTerm/onResetSearch` via props).
- **Pagination**: pakai `components/shared/data-table-pagination.tsx` (`Total N <entity> · halaman P` + Sebelumnya/Berikutnya).
- **Per-menu wajib catat** di `docs/module/<nama>.md`: daftar kolom `searchable/sortable`, `placeholder` search, contoh query (`?search=&sortBy=&sortOrder=`).
- Mutation: invalidate key terkait di `onSuccess`. Contoh:

```typescript
// features/payee/hooks/use-create-payee.ts
export function useCreatePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPayee,          // dari ./api
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payee'] }),
  });
}
```
- `onSuccess` pada query dipakai hanya untuk efek samping state (cache via QueryClient).

## Toast Feedback (wajib setiap mutation CUD)

- Library wajib **sonner** via `@/components/ui/sonner` + `<Toaster richColors position="top-right" />` sekali di `src/app/providers.tsx`; panggil via helper `@/lib/toast` (`toastSuccess`, `toastError`, `getApiErrorMessage`) — jangan import `sonner` langsung di route.
- Aturan: setiap `mutate` create/update/delete **WAJIB** pasang `onSuccess → toastSuccess` + `onError → toastError`, dengan **pengecualian 422** di bawah. Toast dipasang di **call-site** (page `app/routes/*.tsx`) memakai `t()` namespace modul; hooks (`features/<domain>/hooks/use-*.ts`) hanya `invalidateQueries`.
- Format key i18n: `<entity>:toast.created/updated/deleted/createFailed/updateFailed/deleteFailed` (contoh `user:toast.created`, `role:toast.deleteFailed`). Pola error non-422: `toastError(getApiErrorMessage(err, t('<entity>:toast.createFailed')))`.
- **Larang toast untuk 422**: `onError` wajib early-return `if (isValidationError(err)) return;` (helper dari `@/lib/api-client`, re-export via `@/lib/toast`) — 422 tampil per-field via `form.setError`, bukan toast. **Dialog tetap terbuka** saat 422 (jangan `setFormOpen(false)` di jalur error validasi).
- Kasus khusus: mutasi sekunder (assign role / replace permissions) wajib toast sendiri — sukses ikut toast utama, gagal tampil `toastError` + banner walau dialog sudah tertutup; 401/403 ikut alur `ApiError` existing (redirect/gate) — jangan toast sukses.
- Contoh singkat (users):

```typescript
// app/routes/users.tsx — create
createUser.mutate(payload, {
  onSuccess: () => { setFormOpen(false); toastSuccess(t('user:toast.created')); },
  onError: (err: unknown) => {
    if (isValidationError(err)) return; // 422 → per-field di form, dialog tetap terbuka
    toastError(getApiErrorMessage(err, t('user:toast.createFailed')));
  },
});

// app/routes/users.tsx — delete
deleteUser.mutate(id, {
  onSuccess: () => { setDeletingUser(null); toastSuccess(t('user:toast.deleted')); },
  onError: (err: unknown) => {
    if (isValidationError(err)) return;
    toastError(getApiErrorMessage(err, t('user:toast.deleteFailed')));
  },
});
```

- Larangan: `mutate` tanpa toast; hardcode string toast (wajib `t()`); toast di dalam hooks; toast generik untuk 422; edit manual `components/ui/` (tambah via CLI).

## Form & Validasi (RHF + zod, mirror BE)

- Semua form (Login, Register, `user-form-dialog`, `role-form-dialog`, modul baru) pakai **react-hook-form + zod**: schema di dalam komponen, bungkus `useMemo(..., [t])`, pesan hanya dari `t('validation:*')`; field string wajib `trim/max` mirror DTO backend.
- Error 422 dari backend wajib di-map per-field: `useEffect` atas `submissionError`/`error` → `if (!isValidationError(...)) return;` → `for (... of Object.entries(mapApiFieldErrors(err))) form.setError(field, { message })` (`mapApiFieldErrors` dari `@/lib/field-errors`).
- Setiap field punya `<FormMessage />` **kosong** (tanpa children) agar pesan RHF/zod maupun server tampil di tempat yang sama.
- Banner error di atas form **hanya untuk non-422** (409/500/network); 422 tidak tampil di banner, tidak di-toast.
- Pengecualian: `SearchBar` bukan form validasi — bebas kirim hasil debounce tanpa `setError`/banner.

## Tanggal & Waktu

- Kontrak: API mengirim tanggal sebagai ISO 8601 UTC (dengan `Z`); FE tidak pernah menggeser/manual-offset; parsing hanya `new Date(iso)`.
- Tampil via `lib/datetime.ts` (`formatDateTime` default tanggal+jam; `formatDate` bila perlu tanggal saja): locale browser (`undefined`), zona client otomatis (tanpa opsi `timeZone`); larang fungsi format lokal per fitur, larang hardcode `timeZone`/locale.
- Invalid/kosong → `'—'` (helper tidak pernah melempar).
- Kirim: input tanggal (form/filter) dikirim sebagai ISO UTC (`date.toISOString()`); filter tanggal via `filter[createdAt][gte]=<ISO UTC>`.

## API Integration

- Base URL dari `import.meta.env.VITE_API_BASE_URL`, default `/api/v1` (prefix global backend).
- Envelope backend: sukses `{ data, message }`, error `{ statusCode, message, errors }`.
- Unwrap dilakukan **sekali** di `lib/api-client.ts`, bukan di tiap hook.

```typescript
// lib/api-client.ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) throw new ApiError(await res.json()); // { statusCode, message, errors }
  const body = (await res.json()) as { data: T };
  return body.data;
}
```
- Error dinormalisasi jadi class `ApiError` sendiri (statusCode, message, errors[]) — komponen cukup cek `error.statusCode` (401 → redirect login, 422 → tampil per-field).
- Jangan gunakan `any` di boundary input/output API — definisikan type di `features/<domain>/types.ts`.

## Reusable Component

- Semua komponen dibuat **reusable** — presentational, logika data masuk via props, bukan fetch langsung.
- Data-fetching (TanStack Query) di hook/container, bukan di komponen; efek samping di-inject via props `onXXX`.
- Props wajib di-type dengan `interface` — tanpa `any`, tanpa union inline berulang (ekspor type-nya).
- Pada render gunakan `cn()` dari `lib/utils`, dukung override `className`.
- Tanpa import dari domain/fitur lain — hanya `components/shared/`, `components/ui/`, `lib/`.
- Komponen dipakai ≥2 fitur → pindah ke `components/shared/`; spesifik 1 fitur → `features/<domain>/components/`.
- Hindari hardcode teks/data — via props agar bisa dipakai konteks lain.

## Dokumentasi

- Setiap **modul/feature/menu** baru wajib didokumentasikan di `docs/` — bangun brief (`docs/module/<nama>.md`) sebelum/selaras dengan implementasi.
- Rujukan konten: `docs/DESIGN_SYSTEM.md` (design token), `docs/AUTH_PAGES.md` (contoh format brief auth), `docs/module/dashboard.md` (contoh brief modul).
- Brief modul mencatat: routing, struktur folder, komponen yang ditambah (via CLI), kontrak API (atau status TODO bila backend belum siap), konvensi, dan status/catatan.
- Update dokumen yang terpengaruh saat terjadi perubahan struktur/API/design.

## Naming & Style

- Komponen: `PascalCase`; Hook: prefix `use`; fungsi/variabel: `camelCase`; konstanta: `UPPER_SNAKE_CASE`.
- Folder domain singular (`payee/`), folder generic plural (`components/`, `hooks/`).
- File hook: `use-<entity>.ts`; file api: `api/<entity>.ts` atau file per endpoint.
- TypeScript `strict: true`, larang `any` di boundary API, larang `@ts-ignore` tanpa alasan.

## Verifikasi

- `pnpm lint` — ESLint (jalankan setelah perubahan).
- `pnpm tsc --noEmit` — typecheck.
- `pnpm dev` — build dev (Vite).
- Jalankan lint/typecheck sebelum menyelesaikan tugas apa pun.
## Wajib Baca Docs Sebelum Edit

Sebelum edit file apa pun, baca dokumentasi terkait: docs/RULES.md, docs/module/<domain>.md (brief modul yang akan diedit), docs/DESIGN_SYSTEM.md (design token komponen), dan file existing di area yang akan diedit � pahami pattern sebelum menambah. Skip rule ini ? diff biasanya melawan konvensi. Pola ada di existing code; tiru, jangan re-invent.

