import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listArchiveSubmissions } from '../api/archive-submissions'

export interface UseArchiveSubmissionsParams {
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

export function useArchiveSubmissions({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  filter,
  enabled,
}: UseArchiveSubmissionsParams) {
  return useQuery({
    queryKey: [
      'archive-submissions',
      { page, limit, search: (search ?? '').trim(), sortBy, sortOrder, filter },
    ],
    queryFn: () => listArchiveSubmissions({ page, limit, search, sortBy, sortOrder, filter }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
