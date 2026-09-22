import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { CreateStoryInput, Story, UpdateStoryInput } from '../types'

export interface ListPostsParams extends ListParams {
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'PUBLISHED' }`). */
  filter?: Record<string, string>
}

export function listPosts(params: ListPostsParams): Promise<ListResult<Story>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    search.set(`filter[${key}]`, value)
  }
  return requestList<Story>(`/posts?${search.toString()}`)
}

export function getPost(id: string): Promise<Story> {
  return request<Story>(`/posts/${id}`)
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
