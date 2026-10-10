import type { NetworkOrganisationType } from '@/features/network/types'

export type { NetworkOrganisationType } from '@/features/network/types'

export interface NetworkSubmissionSocialMedia {
  platform: string
  url: string
}

export interface NetworkSubmissionSubmitter {
  fullName: string
  email: string
  countryId: number
  stateId?: number | null
}

export interface CreateNetworkSubmissionInput {
  organisationType: NetworkOrganisationType
  name: string
  ledBy?: string
  countryId: number
  stateId?: number
  address?: string
  mapsUrl?: string
  website?: string
  contact: string
  socialMedia?: NetworkSubmissionSocialMedia[]
  activityType?: string
  content: string
  submitter: NetworkSubmissionSubmitter
}

export interface NetworkSubmissionResult {
  id: string
  status: string
}
