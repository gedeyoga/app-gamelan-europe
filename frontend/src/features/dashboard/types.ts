// View types dashboard — minimal, dipetakan dari Event/Story di route page
// agar `features/dashboard/` tetap tanpa import lintas domain (AGENTS.md).

export interface DashboardEventItem {
  id: string
  name: string
  thumbnail: string | null
  /** Label tanggal+jam yang sudah diformat UTC-safe, mis. "Sen, 15 Jan 2026 · 19:30–22:00". */
  dateLabel: string
  /** Tanggal mentah (ISO) dari jadwal terdekat — dipakai chip kalender highlight card. */
  date: string | null
  locationName: string | null
  eventTypes: string[]
}

export interface DashboardPendingEventItem {
  id: string
  name: string
  thumbnail: string | null
  /** Nama organisasi, fallback fullName penyelenggara. */
  creatorName: string | null
  /** Label tanggal pertama yang sudah diformat, null bila tidak ada. */
  dateLabel: string | null
}

export interface DashboardPendingArchiveItem {
  id: string
  name: string
  thumbnail: string | null
  /** Nama pembuat arsip (`creator.fullName`). */
  creatorName: string | null
  description: string | null
  categories: string[]
}

export interface DashboardStoryItem {
  id: string
  name: string
  thumbnail: string | null
  categories: string[]
  authorName: string | null
  publishedAt: string | null
}

export type DashboardArchiveType = 'MEMBER' | 'PUBLIC'

export interface DashboardArchiveItem {
  id: string
  name: string
  thumbnail: string | null
  description: string | null
  categories: string[]
  type: DashboardArchiveType
  publishedAt: string | null
}
