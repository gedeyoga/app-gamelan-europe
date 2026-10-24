import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { ContentStatus, CreateStoryInput, Story, UpdateStoryInput } from '../types'

export interface ListPostsParams extends ListParams {
  /** Filter kategori (UUID); param query top-level `categoryId`. */
  categoryId?: string
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'PUBLISHED' }`). */
  filter?: Record<string, string>
}

export function listPosts(params: ListPostsParams): Promise<ListResult<Story>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  if (params.categoryId) search.set('categoryId', params.categoryId)
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    search.set(`filter[${key}]`, value)
  }
  return requestList<Story>(`/posts?${search.toString()}`)
}

/** Batas keras ID yang dikumpulkan (select-all lintas halaman). */
export const MAX_BULK_IDS = 2000
/** Batas `limit` list backend. */
const IDS_PAGE_LIMIT = 100

/**
 * Kumpulkan ID semua post yang cocok dengan `search`/`categoryId`/`filter`
 * (lintas halaman), untuk select-all. Loop `limit: 100` sampai `total` atau cap 2000.
 */
export async function listAllPostIds({
  search,
  categoryId,
  filter,
}: Omit<ListPostsParams, 'page' | 'limit'>): Promise<string[]> {
  const ids: string[] = []
  for (let page = 1; page <= Math.ceil(MAX_BULK_IDS / IDS_PAGE_LIMIT); page += 1) {
    const result = await listPosts({ page, limit: IDS_PAGE_LIMIT, search, categoryId, filter })
    ids.push(...result.items.map((item) => item.id))
    if (ids.length >= result.total || result.items.length === 0) break
  }
  return ids.slice(0, MAX_BULK_IDS)
}

export function bulkUpdatePostStatus({
  ids,
  status,
}: {
  ids: string[]
  status: ContentStatus
}): Promise<{ updated: number; skipped: number; failed: number }> {
  return request<{ updated: number; skipped: number; failed: number }>('/posts/bulk-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  })
}

export function bulkDeletePosts({
  ids,
}: {
  ids: string[]
}): Promise<{ deleted: number; failed: number }> {
  return request<{ deleted: number; failed: number }>('/posts/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
}

export function getPost(id: string): Promise<Story> {
  return request<Story>(`/posts/${id}`)
}

export function getPostBySlug(slug: string): Promise<Story> {
  return request<Story>(`/posts/slug/${encodeURIComponent(slug)}`)
}

export function createPost(payload: CreateStoryInput): Promise<Story> {
  return request<Story>('/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updatePost(id: string, payload: UpdateStoryInput): Promise<Story> {
  return request<Story>(`/posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deletePost(id: string): Promise<Story> {
  return request<Story>(`/posts/${id}`, { method: 'DELETE' })
}

export function approveStory(id: string, publishedAt: string, notify?: boolean): Promise<Story> {
  return request<Story>(`/posts/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishedAt, ...(notify === undefined ? {} : { notify }) }),
  })
}

export function submitStory(id: string): Promise<Story> {
  return request<Story>(`/posts/${id}/submit`, { method: 'POST' })
}

export function rejectStory(id: string): Promise<Story> {
  return request<Story>(`/posts/${id}/reject`, { method: 'POST' })
}
