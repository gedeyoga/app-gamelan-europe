import { request, requestList } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { CreateNetworkInput, Network, UpdateNetworkInput } from '../types'

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
