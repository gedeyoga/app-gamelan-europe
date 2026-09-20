import { request, requestList } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from '../types'

export type ListOrganizationsParams = ListParams

export interface OrganizationListResult {
  items: Organization[]
  page: number
  limit: number
  total: number
}

export function listOrganizations(params: ListOrganizationsParams): Promise<OrganizationListResult> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  return requestList<Organization>(`/organizations?${search.toString()}`)
}

export function createOrganization(payload: CreateOrganizationInput): Promise<Organization> {
  return request<Organization>('/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateOrganization(
  id: string,
  payload: UpdateOrganizationInput,
): Promise<Organization> {
  return request<Organization>(`/organizations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteOrganization(id: string): Promise<Organization> {
  return request<Organization>(`/organizations/${id}`, { method: 'DELETE' })
}
