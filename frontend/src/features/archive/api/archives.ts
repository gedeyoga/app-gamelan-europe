import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { Archive, ArchiveStatus, CreateArchiveInput, UpdateArchiveInput } from '../types'

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

/** Batas keras ID yang dikumpulkan (select-all lintas halaman). */
export const MAX_BULK_IDS = 2000
/** Batas `limit` list backend. */
const IDS_PAGE_LIMIT = 100

/**
 * Kumpulkan ID semua arsip yang cocok dengan `search`/`mine`/`filter`
 * (lintas halaman), untuk select-all. Loop `limit: 100` sampai `total` atau cap 2000.
 */
export async function listAllArchiveIds({
  search,
  mine,
  filter,
}: Omit<ListArchivesParams, 'page' | 'limit'>): Promise<string[]> {
  const ids: string[] = []
  for (let page = 1; page <= Math.ceil(MAX_BULK_IDS / IDS_PAGE_LIMIT); page += 1) {
    const result = await listArchives({ page, limit: IDS_PAGE_LIMIT, search, mine, filter })
    ids.push(...result.items.map((item) => item.id))
    if (ids.length >= result.total || result.items.length === 0) break
  }
  return ids.slice(0, MAX_BULK_IDS)
}

export function bulkUpdateArchiveStatus({
  ids,
  status,
}: {
  ids: string[]
  status: ArchiveStatus
}): Promise<{ updated: number; skipped: number; failed: number }> {
  return request<{ updated: number; skipped: number; failed: number }>('/archives/bulk-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  })
}

export function bulkDeleteArchives({
  ids,
}: {
  ids: string[]
}): Promise<{ deleted: number; failed: number }> {
  return request<{ deleted: number; failed: number }>('/archives/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
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
