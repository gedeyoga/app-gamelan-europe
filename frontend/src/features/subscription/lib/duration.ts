import type { SubscriptionType } from '../types'

// FE yang menghitung durasi → hari; backend hanya menerima `durationInDays`.
export const DAYS_PER_MONTH = 30
export const DAYS_PER_YEAR = 365

export function toDurationInDays(type: SubscriptionType, amount: number): number {
  return amount * (type === 'YEARLY' ? DAYS_PER_YEAR : DAYS_PER_MONTH)
}

/** Reverse untuk mode edit — dibulatkan karena durasi hari tak selalu kelipatan pas. */
export function fromDurationInDays(type: SubscriptionType, days: number): number {
  const perUnit = type === 'YEARLY' ? DAYS_PER_YEAR : DAYS_PER_MONTH
  return Math.max(1, Math.round(days / perUnit))
}

// ponytail: reverse ini lossy (45 hari MONTHLY → 2 → 60). Ceiling: edit tanpa
// ubah amount tidak mengirim ulang durationInDays, jadi hari asli tetap utuh.
// Upgrade bila butuh edit presisi hari: tampilkan field hari langsung.

// ponytail: belum ada test runner di frontend. Self-check manual:
// toDurationInDays('MONTHLY', 3) === 90; toDurationInDays('YEARLY', 2) === 730;
// fromDurationInDays('MONTHLY', 90) === 3; fromDurationInDays('YEARLY', 730) === 2.
