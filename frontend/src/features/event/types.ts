export type ContentStatus = 'DRAFT' | 'REQUEST' | 'APPROVED' | 'PUBLISHED'

export type EventFormAction = 'save' | 'draft' | 'request' | 'publish' | 'approve' | 'reject'

export type Visibility = 'PUBLIC' | 'PRIVATE'

/** Jenis masuk event: gratis atau berbayar/tiket. */
export type EventEntry = 'FREE' | 'TICKET'

/** Asal konten: pengajuan publik (situs EGS) vs pengajuan member internal. */
export type ContentSource = 'PUBLIC' | 'REGISTERED'

export interface EventType {
  id: string
  name: string
}

export interface EventLocation {
  name: string
  address: string | null
  mapsUrl: string | null
  embedUrl: string | null
  lat: number | null
  lng: number | null
  countryId: number | null
  stateId: number | null
  cityId: number | null
  country: { id: number; name: string; iso2: string } | null
  state: { id: number; name: string } | null
  city: { id: number; name: string } | null
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
  network: { id: string; name: string } | null
}

export interface Event {
  id: string
  name: string
  slug: string
  status: ContentStatus
  visibility: Visibility
  entry: EventEntry
  /** Asal konten (`PUBLIC` = pengajuan publik, `REGISTERED` = member internal). */
  source: ContentSource
  publishedAt: string | null
  approvedAt: string | null
  content?: string
  thumbnail: string | null
  eventTypes: EventType[]
  authors: { id: string; fullName: string }[]
  /** Organisasi penyelenggara event. */
  network: { id: string; name: string } | null
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
  mapsUrl?: string
  countryId?: number
  stateId?: number
  cityId?: number
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
  entry?: EventEntry
  // Bila dikirim: backend menetapkan tanggal ini dan memaksa `status = PUBLISHED`.
  publishedAt?: string
  eventTypeIds?: string[]
  authorIds?: string[]
  /** `null` = clear (edit); `undefined` = biarkan. */
  networkId?: string | null
  /** Tanggal event; bila diisi minimal 1. */
  dates?: EventDateInput[]
  /** Wajib — satu event = satu lokasi. */
  location: EventLocationInput
}

// `thumbnail: null` menghapus thumbnail; field di-omit bila tidak diubah.
export type UpdateEventInput = Partial<CreateEventInput>

export const CONTENT_STATUSES = ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] as const

export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const

export const EVENT_ENTRIES = ['FREE', 'TICKET'] as const
