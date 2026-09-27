import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listStorySubmissions } from '../api/story-submissions'

export interface UseStorySubmissionsParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'REQUEST' }`). */
  filter?: Record<string, string>
  /** `false` → query tidak dijalankan (gate dashboard). */
  enabled?: boolean
}

export function useStorySubmissions({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  filter,
  enabled,
}: UseStorySubmissionsParams) {
  return useQuery({
    queryKey: [
      'story-submissions',
      { page, limit, search: (search ?? '').trim(), sortBy, sortOrder, filter },
    ],
    queryFn: () => listStorySubmissions({ page, limit, search, sortBy, sortOrder, filter }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
