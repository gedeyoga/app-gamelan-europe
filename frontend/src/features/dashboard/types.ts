// View types dashboard — minimal, dipetakan dari Event/Story di route page
// agar `features/dashboard/` tetap tanpa import lintas domain (AGENTS.md).

export interface DashboardEventItem {
  id: string
  name: string
  thumbnail: string | null
  /** Label tanggal+jam yang sudah diformat UTC-safe, mis. "Sen, 15 Jan 2026 · 19:30–22:00". */
  dateLabel: string
  locationName: string | null
  eventTypes: string[]
}

export interface DashboardStoryItem {
  id: string
  name: string
  thumbnail: string | null
  categories: string[]
  authorName: string | null
  publishedAt: string | null
}
