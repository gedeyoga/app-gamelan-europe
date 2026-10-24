import { request, requestList } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type {
  BulkUpdateNetworkStatusInput,
  BulkUpdateNetworkStatusResult,
  CreateNetworkInput,
  Network,
  UpdateNetworkInput,
} from '../types'

export interface ListNetworksParams extends ListParams {
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'REQUEST' }`). */
  filter?: Record<string, string>
}

export interface NetworkListResult {
  items: Network[]
  page: number
  limit: number
  total: number
}

export function listNetworks(params: ListNetworksParams): Promise<NetworkListResult> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    search.set(`filter[${key}]`, value)
  }
  return requestList<Network>(`/networks?${search.toString()}`)
}

/** Batas keras ID yang dikumpulkan (select-all lintas halaman). */
export const MAX_BULK_IDS = 2000
/** Batas `limit` list backend. */
const IDS_PAGE_LIMIT = 100

/**
 * Kumpulkan ID semua baris yang cocok dengan `search`/`filter` (lintas halaman),
 * untuk select-all. Loop `limit: 100` sampai `total` tercapai atau kena cap 2000.
 */
export async function listAllNetworkIds({
  search,
  filter,
}: Omit<ListNetworksParams, 'page' | 'limit'>): Promise<string[]> {
  const ids: string[] = []
  for (let page = 1; page <= Math.ceil(MAX_BULK_IDS / IDS_PAGE_LIMIT); page += 1) {
    const result = await listNetworks({ page, limit: IDS_PAGE_LIMIT, search, filter })
    ids.push(...result.items.map((item) => item.id))
    if (ids.length >= result.total || result.items.length === 0) break
  }
  return ids.slice(0, MAX_BULK_IDS)
}

export function getNetwork(id: string): Promise<Network> {
  return request<Network>(`/networks/${id}`)
}

export function createNetwork(payload: CreateNetworkInput): Promise<Network> {
  return request<Network>('/networks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateNetwork(id: string, payload: UpdateNetworkInput): Promise<Network> {
  return request<Network>(`/networks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteNetwork(id: string): Promise<Network> {
  return request<Network>(`/networks/${id}`, { method: 'DELETE' })
}

export function approveNetwork(id: string, publishedAt?: string): Promise<Network> {
  if (publishedAt === undefined) {
    return request<Network>(`/networks/${id}/approve`, { method: 'POST' })
  }
  return request<Network>(`/networks/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishedAt }),
  })
}

export function rejectNetwork(id: string): Promise<Network> {
  return request<Network>(`/networks/${id}/reject`, { method: 'POST' })
}

/** `DRAFT` → `REQUEST`. */
export function submitNetwork(id: string): Promise<Network> {
  return request<Network>(`/networks/${id}/submit`, { method: 'POST' })
}

/** `PUBLISHED` → `DRAFT`. */
export function unpublishNetwork(id: string): Promise<Network> {
  return request<Network>(`/networks/${id}/unpublish`, { method: 'POST' })
}

export function bulkUpdateNetworkStatus({
  ids,
  status,
}: BulkUpdateNetworkStatusInput): Promise<BulkUpdateNetworkStatusResult> {
  return request<BulkUpdateNetworkStatusResult>('/networks/bulk-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  })
}
