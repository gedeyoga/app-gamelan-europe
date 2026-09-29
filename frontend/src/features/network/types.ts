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
  /** Rich HTML. */
  content: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateNetworkInput {
  name: string
  /** `null` = clear; `undefined` = biarkan. */
  state?: string | null
  country?: string | null
  address?: string | null
  website?: string | null
  contact?: string | null
  /** `null` = clear; maks 10 entri. */
  socialMedia?: NetworkSocialMedia[] | null
  lat?: number | null
  lng?: number | null
  /** `null` = clear; `undefined` = biarkan. */
  content?: string | null
}

export type UpdateNetworkInput = Partial<CreateNetworkInput>
