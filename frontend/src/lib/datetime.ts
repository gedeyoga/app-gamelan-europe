// Helper tanggal & waktu client-side — satu-satunya titik format tanggal di FE.
// Kontrak: API mengirim ISO 8601 UTC (dengan `Z`); parsing hanya `new Date(iso)`
// tanpa geser/manual-offset; tampil memakai locale browser + zona client otomatis.
//
// - `formatDateTime`: default tanggal + jam (dateStyle medium, timeStyle short).
// - `formatDate`: varian tanggal saja (dateStyle medium), untuk kebutuhan yang memang hanya tanggal.
// - Input kosong/invalid → `'—'`, tidak pernah melempar.
// - Tanpa hardcode locale/timezone. `locales`/`options` hanya override opsional;
//   default tetap browser (`undefined`) + zona client (tanpa opsi `timeZone`).

export type DateTimeInput = string | Date | null | undefined

export const DATETIME_FALLBACK = '—'

function toDate(value: DateTimeInput): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    if (value.trim().length === 0) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value
  }
  return null
}

/**
 * Tanggal + jam zona client, locale browser.
 * Contoh: `formatDateTime(user.createdAt)` → `"15 Jan 2026, 14.30"`.
 * Kirim tanggal: `date.toISOString()` (ISO UTC); filter: `filter[createdAt][gte]=<ISO UTC>`.
 */
export function formatDateTime(
  value: DateTimeInput,
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value)
  if (date === null) return DATETIME_FALLBACK
  try {
    return new Intl.DateTimeFormat(locales, {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...options,
    }).format(date)
  } catch {
    return DATETIME_FALLBACK
  }
}

/**
 * Tanggal saja (tanpa jam), locale browser, zona client.
 * Pakai hanya bila kebutuhan memang tanggal saja; default tampil pakai `formatDateTime`.
 */
export function formatDate(
  value: DateTimeInput,
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value)
  if (date === null) return DATETIME_FALLBACK
  try {
    return new Intl.DateTimeFormat(locales, { dateStyle: 'medium', ...options }).format(date)
  } catch {
    return DATETIME_FALLBACK
  }
}
