import { request, requestList, type ListResult } from '@/lib/api-client'

import type { StoryCategory } from '../types'

const STORY_CATEGORY_QUERY = 'filter[type]=STORY&limit=100'

export function listCategories(): Promise<ListResult<StoryCategory>> {
  return requestList<StoryCategory>(`/categories?${STORY_CATEGORY_QUERY}`)
}

export interface CreateCategoryInput {
  name: string
  type: 'STORY'
}

// Idempotent: nama+type sama mengembalikan existing (bukan 409).
export function createCategory(payload: CreateCategoryInput): Promise<StoryCategory> {
  return request<StoryCategory>('/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteCategory(id: string): Promise<StoryCategory> {
  return request<StoryCategory>(`/categories/${id}`, { method: 'DELETE' })
}
