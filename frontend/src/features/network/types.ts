export type NetworkStatus = 'DRAFT' | 'REQUEST' | 'APPROVED' | 'PUBLISHED'

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
  createdBy: string | null
  submitterFullName: string | null
  submitterEmail: string | null
  submitterCountry: string | null
  submitterState: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateNetworkInput {
  name: string
  organisationType?: NetworkOrganisationType | null
  ledBy?: string | null
  /** `null` = clear; `undefined` = biarkan. */
  state?: string | null
  country?: string | null
  address?: string | null
  website?: string | null
  mapsUrl?: string | null
  contact?: string | null
  /** `null` = clear; maks 10 entri. */
  socialMedia?: NetworkSocialMedia[] | null
  activityType?: string | null
  /** `null` = clear; `undefined` = biarkan. */
  content?: string | null
  submitterFullName?: string | null
  submitterEmail?: string | null
  /** Nama country (display), bukan id. */
  submitterCountry?: string | null
  /** Nama state (display), bukan id. */
  submitterState?: string | null
}

export type UpdateNetworkInput = Partial<CreateNetworkInput>
