export type EventSubmissionStatus = 'REQUEST' | 'APPROVED' | 'REJECTED'

export interface EventSubmission {
  id: string
  title: string
  organiser: string
  country: { id: number; iso2: string; name: string } | null
  state: { id: number; name: string } | null
  eventType: { id: string; name: string } | null
  /** URL absolut thumbnail, null bila tidak ada. */
  thumbnail: string | null
  /** ISO 8601 UTC. */
  startDate: string
  endDate: string
  status: EventSubmissionStatus
  createdAt: string
  updatedAt: string
}

export interface ApproveEventSubmissionResult {
  event: { id: string; slug: string; status: 'DRAFT' }
}
