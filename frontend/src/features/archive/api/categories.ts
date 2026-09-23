import { request, requestList, type ListResult } from '@/lib/api-client'

import type { ArchiveCategory } from '../types'

const ARCHIVE_CATEGORY_QUERY = 'filter[type]=ARCHIVE&limit=100'

export function listArchiveCategories(): Promise<ListResult<ArchiveCategory>> {
  return requestList<ArchiveCategory>(`/categories?${ARCHIVE_CATEGORY_QUERY}`)
}

export interface CreateArchiveCategoryInput {
  name: string
  type: 'ARCHIVE'
}

// Idempotent: nama+type sama mengembalikan existing (bukan 409).
export function createArchiveCategory(
  payload: CreateArchiveCategoryInput,
): Promise<ArchiveCategory> {
  return request<ArchiveCategory>('/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
