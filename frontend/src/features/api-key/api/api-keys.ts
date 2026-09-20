import { request, requestList } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { ApiKey, CreateApiKeyInput, CreatedApiKey, UpdateApiKeyInput } from '../types'

export type ListApiKeysParams = Partial<ListParams>

export function listApiKeys(params: ListApiKeysParams = {}): Promise<{
  items: ApiKey[]
  page: number
  limit: number
  total: number
}> {
  const search = new URLSearchParams()
  appendListParams(search, {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  })
  return requestList<ApiKey>(`/api-keys?${search.toString()}`)
}

export function getApiKey(id: string): Promise<ApiKey> {
  return request<ApiKey>(`/api-keys/${id}`)
}

export function createApiKey(payload: CreateApiKeyInput): Promise<CreatedApiKey> {
  return request<CreatedApiKey>('/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateApiKey(id: string, payload: UpdateApiKeyInput): Promise<ApiKey> {
  return request<ApiKey>(`/api-keys/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteApiKey(id: string): Promise<null> {
  return request<null>(`/api-keys/${id}`, { method: 'DELETE' })
}
