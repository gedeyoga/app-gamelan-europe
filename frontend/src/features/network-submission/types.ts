import type { NetworkOrganisationType } from '@/features/network/types'

export type { NetworkOrganisationType } from '@/features/network/types'

export interface NetworkSubmissionSocialMedia {
  platform: string
  url: string
}

export interface NetworkSubmissionSubmitter {
  email: string
}

export interface CreateNetworkSubmissionInput {
  organisationType: NetworkOrganisationType
  name: string
  ledBy?: string
  countryId: number
  stateId?: number
  cityId?: number
  address?: string
  mapsUrl?: string
  website?: string
  contact?: string
  socialMedia?: NetworkSubmissionSocialMedia[]
  activityType?: string
  content: string
  submitter: NetworkSubmissionSubmitter
}

export interface NetworkSubmissionResult {
  id: string
  status: string
}
