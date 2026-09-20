import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listEvents } from '../api/events'

export interface UseEventsParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

export function useEvents({ page, limit, search, sortBy, sortOrder }: UseEventsParams) {
  return useQuery({
    queryKey: ['event', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listEvents({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
