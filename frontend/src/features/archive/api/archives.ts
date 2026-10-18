import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { Archive, CreateArchiveInput, UpdateArchiveInput } from '../types'

export interface ListArchivesParams extends ListParams {
  /** `true` → hanya arsip milik user (diteruskan ke `GET /archives`). */
  mine?: boolean
  /** Filter generik `filter[<key>]=<value>` (mis. `{ type: 'PUBLIC' }`). */
  filter?: Record<string, string>
}

export function listArchives(params: ListArchivesParams): Promise<ListResult<Archive>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  if (params.mine) search.set('mine', 'true')
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    search.set(`filter[${key}]`, value)
  }
  return requestList<Archive>(`/archives?${search.toString()}`)
}

export function getArchive(id: string): Promise<Archive> {
  return request<Archive>(`/archives/${id}`)
}

export function getArchiveBySlug(slug: string): Promise<Archive> {
  return request<Archive>(`/archives/slug/${encodeURIComponent(slug)}`)
}

export function createArchive(payload: CreateArchiveInput): Promise<Archive> {
  return request<Archive>('/archives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateArchive(id: string, payload: UpdateArchiveInput): Promise<Archive> {
  return request<Archive>(`/archives/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteArchive(id: string): Promise<Archive> {
  return request<Archive>(`/archives/${id}`, { method: 'DELETE' })
}

export function submitArchive(id: string): Promise<Archive> {
  return request<Archive>(`/archives/${id}/submit`, { method: 'POST' })
}

export function approveArchive(
  id: string,
  publishedAt?: string,
  notify?: boolean,
): Promise<Archive> {
  const body = {
    ...(publishedAt === undefined ? {} : { publishedAt }),
    ...(notify === undefined ? {} : { notify }),
  }
  if (Object.keys(body).length === 0) {
    return request<Archive>(`/archives/${id}/approve`, { method: 'POST' })
  }
  return request<Archive>(`/archives/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function rejectArchive(id: string): Promise<Archive> {
  return request<Archive>(`/archives/${id}/reject`, { method: 'POST' })
}
