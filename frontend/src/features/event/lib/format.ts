import { DATETIME_FALLBACK, formatDate } from '@/lib/datetime'

import type { EventDate } from '../types'

/**
 * Tanggal API (ISO datetime, tersimpan UTC midnight) → `"YYYY-MM-DD"`.
 * Baca komponen UTC agar hari tidak bergeser oleh timezone client.
 */
export function toDateOnly(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${parsed.getUTCFullYear()}-${month}-${day}`
}

export interface EventDateParts {
  /** `"YYYY-MM-DD"` untuk atribut `<time datetime>`. */
  iso: string
  /** Nomor hari, mis. `"15"`. */
  day: string
  /** Bulan + tahun lokal browser, mis. `"Jan 2026"`. */
  monthYear: string
  /** Nama hari lokal browser, mis. `"Kamis"`. */
  weekday: string
  /** `"HH:mm–HH:mm"` bila ada. */
  timeRange: string
}

/** Pecahan tanggal event untuk blok kalender (hari besar + bulan/tahun + hari + jam). */
export function getEventDateParts({ date, startTime, endTime }: EventDate): EventDateParts {
  const iso = toDateOnly(date)
  const [year, month, day] = iso.split('-').map(Number)
  // Date lokal tengah hari agar hari yang ditampilkan tidak bergeser.
  const local = year && month && day ? new Date(year, month - 1, day, 12) : null
  return {
    iso,
    day: local ? String(local.getDate()) : '',
    monthYear: local
      ? formatDate(local, undefined, { dateStyle: undefined, month: 'short', year: 'numeric' })
      : DATETIME_FALLBACK,
    weekday: local
      ? formatDate(local, undefined, { dateStyle: undefined, weekday: 'long' })
      : DATETIME_FALLBACK,
    // `||` (bukan `??`) agar string kosong dianggap absen, bukan menutupi sisi lain.
    timeRange: startTime && endTime ? `${startTime}–${endTime}` : startTime || endTime || '',
  }
}

/** Tanggal event (tanpa jam insidental) + rentang jam "HH:mm–HH:mm" bila ada. */
export function formatEventDate({ date, startTime, endTime }: EventDate): string {
  const [year, month, day] = toDateOnly(date).split('-').map(Number)
  // Date lokal tengah hari agar hari yang ditampilkan tidak bergeser.
  const display =
    year && month && day
      ? formatDate(new Date(year, month - 1, day, 12), undefined, {
          // `dateStyle: undefined` wajib — Intl melarang gabung dateStyle + field individual.
          dateStyle: undefined,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : DATETIME_FALLBACK
  // `||` (bukan `??`) agar string kosong dianggap absen, bukan menutupi sisi lain.
  const range = startTime && endTime ? `${startTime}–${endTime}` : startTime || endTime || ''
  return range ? `${display} · ${range}` : display
}
