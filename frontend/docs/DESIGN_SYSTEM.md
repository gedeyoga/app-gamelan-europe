# Design System — Frontend Trade App

Dokumen ini mencatat design system frontend, berdasarkan konfigurasi aktual saat ini.

## 1. Basis

- UI library: **shadcn/ui** (style `radix-nova`).
- CSS framework: **Tailwind CSS v4**.
- Design token: didefinisikan sebagai CSS custom properties (format `oklch`) di `src/index.css`.
- Konfigurasi shadcn: `frontend/components.json`:
  - `style`: `radix-nova`
  - `baseColor`: `neutral`
  - `cssVariables`: `true`
  - `iconLibrary`: `lucide`
  - `css`: `src/index.css`
  - `aliases`: `components` → `@/components`, `utils` → `@/lib/utils`, `ui` → `@/components/ui`, `lib` → `@/lib`, `hooks` → `@/hooks`

## 2. Aturan Inti

- Selalu gunakan token dari design system. **Larang** hardcode warna, spacing, atau radius — pakai utility Tailwind yang memetakan ke token (contoh: `bg-background`, `text-muted-foreground`, `rounded-lg`).
- Komponen di `src/components/ui/` adalah hasil generate shadcn/ui. Tambah komponen **hanya** via CLI:

  ```
  pnpm dlx shadcn@latest add <component>
  ```

  Jangan edit manual file di `src/components/ui/`.
- Komponen di `src/components/shared/` boleh di-style memakai token design system.

## 3. Typography

- Font utama: **Geist Variable** (`@fontsource-variable/geist`).
- `--font-sans` = `'Geist Variable', sans-serif`.
- `--font-heading` mewarisi `--font-sans` (fallback).
- Ukuran font via utility Tailwind (`text-sm`, `text-base`, `text-lg`, dst.).

## 4. Warna

Palet dasar **netral** (oklch). Nilai light ada di `:root`, override dark di `.dark`. Token berikut tersedia:

| Token | Makna / Pemakaian |
| --- | --- |
| `--background` | Warna latar utama halaman (`body`) |
| `--foreground` | Warna teks utama |
| `--card` | Latar kartu/panel |
| `--card-foreground` | Teks di dalam kartu |
| `--popover` | Latar popover/dropdown |
| `--popover-foreground` | Teks di dalam popover |
| `--primary` | Warna aksi/elemen utama |
| `--primary-foreground` | Teks di atas `primary` |
| `--secondary` | Latar elemen sekunder |
| `--secondary-foreground` | Teks di atas `secondary` |
| `--muted` | Latar elemen redup |
| `--muted-foreground` | Teks sekunder/redup |
| `--accent` | Latar aksen (hover/selected) |
| `--accent-foreground` | Teks di atas `accent` |
| `--destructive` | Warna aksi destruktif (hapus, error) |
| `--border` | Warna border umum |
| `--input` | Warna border/field input |
| `--ring` | Warna focus ring |
| `--chart-1` | Warna chart 1 |
| `--chart-2` | Warna chart 2 |
| `--chart-3` | Warna chart 3 |
| `--chart-4` | Warna chart 4 |
| `--chart-5` | Warna chart 5 |
| `--sidebar` | Latar sidebar |
| `--sidebar-foreground` | Teks sidebar |
| `--sidebar-primary` | Warna aksen utama sidebar |
| `--sidebar-primary-foreground` | Teks di atas `--sidebar-primary` |
| `--sidebar-accent` | Latar aksen sidebar |
| `--sidebar-accent-foreground` | Teks di atas `--sidebar-accent` |
| `--sidebar-border` | Border sidebar |
| `--sidebar-ring` | Focus ring sidebar |

Semua token dipetakan ke utility Tailwind lewat blok `@theme inline` sebagai `--color-*` (contoh: `--color-background: var(--background)`).

## 5. Radius

- Radius dasar: `--radius: 0.625rem`.
- Skala radius dihitung di `@theme inline`:
  - `--radius-sm`: `calc(var(--radius) * 0.6)`
  - `--radius-md`: `calc(var(--radius) * 0.8)`
  - `--radius-lg`: `var(--radius)`
  - `--radius-xl`: `calc(var(--radius) * 1.4)`
  - `--radius-2xl`: `calc(var(--radius) * 1.8)`
  - `--radius-3xl`: `calc(var(--radius) * 2.2)`
  - `--radius-4xl`: `calc(var(--radius) * 2.6)`

## 6. Dark Mode

- Dark mode dikontrol lewat class `dark` di elemen `<html>`.
- Variant dark didefinisikan via `@custom-variant dark (&:is(.dark *));`.
- Override nilai token dark ada di selector `.dark`.
- Cara toggle: tambah/hapus class `dark` pada `<html>`.

  ```html
  <html class="dark">
  ```

## 7. Ikon

- Ikon memakai **lucide-react**, terintegrasi lewat shadcn/ui (`iconLibrary: "lucide"`).

## 8. Komponen Tersedia

Katalog dari `src/components/ui/` saat ini:

| Komponen | File |
| --- | --- |
| Button | `src/components/ui/button.tsx` |

Cara menambah komponen baru (via CLI, jangan manual):

```
pnpm dlx shadcn@latest add <component>
```

## 9. Pola Penggunaan

- Gunakan `cn()` dari `@/lib/utils` untuk menggabungkan className dan mendukung override `className` dari props.
- Komposisi komponen shadcn: gunakan `asChild` (Radix Slot) untuk mengganti elemen dasar, dan override `className` untuk menyesuaikan style lokal.
- Jangan override token global (`:root`/`.dark`) untuk kasus sekali pakai — gunakan utility Tailwind/className lokal.
- Ikuti aturan reusable component di `AGENTS.md`: presentational, data via props, tanpa fetch di komponen, tanpa import lintas domain.

## 10. Pola List CRUD: SearchBar + SortableHeader + Pagination

Wajib dipakai semua menu CRUD (detail rules di `AGENTS.md` seksi List CRUD):

- **SearchBar** (`src/components/shared/search-bar.tsx`): `Input` shadcn + ikon `Search` kiri (`text-muted-foreground`), tombol clear `X` (`Button ghost size=icon`, `aria-label="Hapus pencarian"`) hanya saat `value` non-kosong; wrapper `relative w-full max-w-sm`; `role="searchbox"`.
- **SortableHeader** (`src/components/shared/sortable-header.tsx`): `Button variant=ghost size=sm` (`-ml-2 h-8 gap-1 px-2 font-medium`), ikon `ArrowUpDown` (idle, `text-muted-foreground`) / `ArrowUp` / `ArrowDown` (aktif); `aria-sort` (`none/ascending/descending`) + `aria-label="Urutkan berdasarkan <Kolom>"`; kolom `Aksi` tidak sortable.
- **Pagination** (`src/components/shared/data-table-pagination.tsx`): baris `Total N <entity> · halaman P` (`text-sm text-muted-foreground`) + tombol `Sebelumnya/Berikutnya` (`Button outline size=sm`, disabled saat `page<=1` / tidak ada next / `isPending`).
- Bahasa UI Indonesia; empty state tabel bedakan kosong vs hasil search nihil (+ tombol `Reset pencarian`).

## 11. Tanggal & Waktu

- Tampil tanggal + jam waktu client via helper shared `src/lib/datetime.ts` — default `formatDateTime(value)` (`dateStyle: 'medium'`, `timeStyle: 'short'`); `formatDate(value)` hanya bila kebutuhan memang tanggal saja.
- Locale mengikuti browser (`undefined`), zona mengikuti client (tanpa opsi `timeZone`); larang fungsi format lokal per fitur, larang hardcode locale/`timeZone`.
- Contoh:

  ```tsx
  import { formatDateTime } from '@/lib/datetime'

  <TableCell>{formatDateTime(user.createdAt)}</TableCell>
  ```

- Nilai kosong/invalid (termasuk `NaN`) tampil sebagai `'—'` dan tidak pernah melempar.
- Kirim tanggal sebagai ISO UTC: `date.toISOString()`; contoh filter: `filter[createdAt][gte]=<ISO UTC>`.

## Lampiran — Nilai Token (Light `:root`)

Nilai aktual dari `src/index.css` (blok `:root`):

| Token | Nilai |
| --- | --- |
| `--background` | `oklch(1 0 0)` |
| `--foreground` | `oklch(0.145 0 0)` |
| `--card` | `oklch(1 0 0)` |
| `--card-foreground` | `oklch(0.145 0 0)` |
| `--popover` | `oklch(1 0 0)` |
| `--popover-foreground` | `oklch(0.145 0 0)` |
| `--primary` | `oklch(0.205 0 0)` |
| `--primary-foreground` | `oklch(0.985 0 0)` |
| `--secondary` | `oklch(0.97 0 0)` |
| `--secondary-foreground` | `oklch(0.205 0 0)` |
| `--muted` | `oklch(0.97 0 0)` |
| `--muted-foreground` | `oklch(0.556 0 0)` |
| `--accent` | `oklch(0.97 0 0)` |
| `--accent-foreground` | `oklch(0.205 0 0)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` |
| `--border` | `oklch(0.922 0 0)` |
| `--input` | `oklch(0.922 0 0)` |
| `--ring` | `oklch(0.708 0 0)` |
| `--chart-1` | `oklch(0.87 0 0)` |
| `--chart-2` | `oklch(0.556 0 0)` |
| `--chart-3` | `oklch(0.439 0 0)` |
| `--chart-4` | `oklch(0.371 0 0)` |
| `--chart-5` | `oklch(0.269 0 0)` |
| `--radius` | `0.625rem` |
| `--sidebar` | `oklch(0.985 0 0)` |
| `--sidebar-foreground` | `oklch(0.145 0 0)` |
| `--sidebar-primary` | `oklch(0.205 0 0)` |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` |
| `--sidebar-accent` | `oklch(0.97 0 0)` |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` |
| `--sidebar-border` | `oklch(0.922 0 0)` |
| `--sidebar-ring` | `oklch(0.708 0 0)` |

Base layer:

```
* { @apply border-border outline-ring/50; }
body { @apply bg-background text-foreground; }
html { @apply font-sans; }
```
