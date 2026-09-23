export interface Organization {
  id: string
  name: string
  state: string | null
  country: string | null
  address: string | null
  lat: number | null
  lng: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateOrganizationInput {
  name: string
  /** `null` = clear; `undefined` = biarkan. */
  state?: string | null
  country?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
}

export type UpdateOrganizationInput = Partial<CreateOrganizationInput>

// Semua kolom tampil di tabel Organizations (mirror ORGANIZATION_SORT_FIELDS backend).
export const ORGANIZATION_SORTABLE_FIELDS = [
  'name',
  'state',
  'country',
  'address',
  'createdAt',
  'updatedAt',
] as const
