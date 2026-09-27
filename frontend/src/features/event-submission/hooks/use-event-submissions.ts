import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listEventSubmissions } from '../api/event-submissions'

export interface UseEventSubmissionsParams {
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

export function useEventSubmissions({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  filter,
  enabled,
}: UseEventSubmissionsParams) {
  return useQuery({
    queryKey: [
      'event-submissions',
      { page, limit, search: (search ?? '').trim(), sortBy, sortOrder, filter },
    ],
    queryFn: () => listEventSubmissions({ page, limit, search, sortBy, sortOrder, filter }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
