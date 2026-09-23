export type ContentStatus = 'DRAFT' | 'REQUEST' | 'APPROVED' | 'PUBLISHED'

export type EventFormAction = 'save' | 'draft' | 'request' | 'publish' | 'approve' | 'reject'

export type Visibility = 'PUBLIC' | 'PRIVATE'

export interface EventType {
  id: string
  name: string
}

export interface EventLocation {
  name: string
  address: string | null
  lat: number | null
  lng: number | null
}

/** Tanggal event dari API: `date` ISO 8601 UTC; `startTime`/`endTime` "HH:mm" atau null. */
export interface EventDate {
  date: string
  startTime: string | null
  endTime: string | null
}

export interface EventCreator {
  id: string
  fullName: string
  organization: { id: string; name: string } | null
}

export interface Event {
  id: string
  name: string
  slug: string
  status: ContentStatus
  visibility: Visibility
  publishedAt: string | null
  approvedAt: string | null
  content?: string
  thumbnail: string | null
  eventTypes: EventType[]
  /** Tanggal event, berurut. */
  dates: EventDate[]
  location: EventLocation | null
  creator: EventCreator | null
  createdAt: string
  updatedAt: string
}

export interface EventLocationInput {
  name: string
  address?: string
  lat?: number
  lng?: number
}

/** Payload tanggal: `date` "YYYY-MM-DD"; `startTime`/`endTime` "HH:mm" (opsional). */
export interface EventDateInput {
  date: string
  startTime?: string
  endTime?: string
}

export interface CreateEventInput {
  name: string
  slug?: string
  content?: string
  thumbnail?: string | null
  status?: ContentStatus
  visibility?: Visibility
  // Bila dikirim: backend menetapkan tanggal ini dan memaksa `status = PUBLISHED`.
  publishedAt?: string
  eventTypeIds?: string[]
  /** Tanggal event; bila diisi minimal 1. */
  dates?: EventDateInput[]
  /** Wajib — satu event = satu lokasi. */
  location: EventLocationInput
}

// `thumbnail: null` menghapus thumbnail; field di-omit bila tidak diubah.
export type UpdateEventInput = Partial<CreateEventInput>

export const CONTENT_STATUSES = ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] as const

export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const
