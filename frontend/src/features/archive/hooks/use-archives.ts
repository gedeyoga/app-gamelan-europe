import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listArchives } from '../api/archives'

export interface UseArchivesParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  /** `true` → hanya arsip milik user (diteruskan ke `GET /archives`). */
  mine?: boolean
  /** Filter generik `filter[<key>]=<value>` (diteruskan ke `GET /archives`). */
  filter?: Record<string, string>
  enabled?: boolean
}

export function useArchives({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  mine,
  filter,
  enabled,
}: UseArchivesParams) {
  return useQuery({
    queryKey: [
      'archive',
      { page, limit, search: (search ?? '').trim(), sortBy, sortOrder, mine, filter },
    ],
    queryFn: () => listArchives({ page, limit, search, sortBy, sortOrder, mine, filter }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
