export const NETWORK_STATUSES = ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] as const

export type NetworkStatus = (typeof NETWORK_STATUSES)[number]

export type NetworkOrganisationType = 'GAMELAN_GROUP' | 'ASSOCIATION' | 'INSTITUTION'

export interface NetworkSocialMedia {
  platform: string
  url: string
}

export interface Network {
  id: string
  name: string
  state: string | null
  country: string | null
  address: string | null
  website: string | null
  contact: string | null
  socialMedia: NetworkSocialMedia[] | null
  lat: number | null
  lng: number | null
  embedUrl: string | null
  /** Rich HTML. */
  content: string | null
  status: NetworkStatus
  source: 'PUBLIC' | 'REGISTERED'
  publishedAt: string | null
  approvedAt: string | null
  organisationType: NetworkOrganisationType | null
  ledBy: string | null
  mapsUrl: string | null
  activityType: string | null
  countryId: number | null
  stateId: number | null
  cityId: number | null
  city: { id: number; name: string } | null
  createdBy: string | null
  submitterEmail: string | null
  createdAt: string
  updatedAt: string
}

/** Target bulk valid — endpoint menerima `DRAFT` (unpublish/reject), `REQUEST` (submit), `PUBLISHED` (approve). */
export type BulkNetworkStatus = Extract<NetworkStatus, 'DRAFT' | 'REQUEST' | 'PUBLISHED'>

export interface BulkUpdateNetworkStatusInput {
  /** Maks 100 UUID. */
  ids: string[]
  status: BulkNetworkStatus
}

export interface BulkUpdateNetworkStatusResult {
  updated: number
  skipped: number
  failed: number
}

export interface CreateNetworkInput {
  name: string
  organisationType?: NetworkOrganisationType | null
  ledBy?: string | null
  countryId?: number
  stateId?: number
  cityId?: number
  address?: string | null
  website?: string | null
  mapsUrl?: string | null
  contact?: string | null
  /** `null` = clear; maks 10 entri. */
  socialMedia?: NetworkSocialMedia[] | null
  activityType?: string | null
  /** `null` = clear; `undefined` = biarkan. */
  content?: string | null
  submitterEmail?: string | null
}

export type UpdateNetworkInput = Partial<CreateNetworkInput>
