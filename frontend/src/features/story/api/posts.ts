import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { CreateStoryInput, Story, UpdateStoryInput } from '../types'

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
