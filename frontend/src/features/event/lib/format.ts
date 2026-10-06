import { DATETIME_FALLBACK, formatDate } from '@/lib/datetime'

import type { Event, EventDate } from '../types'

/** Kredit event: organizer (network) → authors → createdBy. `null` bila tak ada semuanya. */
export function getEventCreditName(event: Event): string | null {
  const candidates = [
    event.network?.name,
    event.authors.map((author) => author.fullName).join(', '),
    event.creator?.fullName,
  ]
  // `trim` + `||` agar string kosong/whitespace dianggap absen.
  return candidates.map((name) => name?.trim()).find(Boolean) || null
}

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

export interface EventDateLines {
  /** Teks tanggal, mis. `"Sen, 15 Jan 2026"`. */
  date: string
  /** `"HH:mm–HH:mm"` bila ada, `''` bila tidak. */
  time: string
}

/** Tanggal dan jam terpisah agar bisa ditumpuk (tanggal <br/> jam) di UI. */
export function formatEventDateLines({ date, startTime, endTime }: EventDate): EventDateLines {
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
  return { date: display, time: range }
}

/**
 * Tanggal event panjang (`"12 October 2026"`) — baca komponen UTC (`toDateOnly`)
 * lalu proyeksikan noon lokal agar hari tidak bergeser di offset negatif.
 */
export function formatEventDateLong({ date }: EventDate): string {
  const [year, month, day] = toDateOnly(date).split('-').map(Number)
  if (!year || !month || !day) return DATETIME_FALLBACK
  return formatDate(new Date(year, month - 1, day, 12), undefined, {
    // `dateStyle: undefined` wajib — Intl melarang gabung dateStyle + field individual.
    dateStyle: undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Tanggal event (tanpa jam insidental) + rentang jam "HH:mm–HH:mm" bila ada. */
export function formatEventDate(eventDate: EventDate): string {
  const { date, time } = formatEventDateLines(eventDate)
  return time ? `${date} · ${time}` : date
}
