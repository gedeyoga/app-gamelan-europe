import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listAvailableSubscriptions } from '../api/my-subscription'

export interface UseAvailableSubscriptionsParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  enabled?: boolean
}

export function useAvailableSubscriptions({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  enabled,
}: UseAvailableSubscriptionsParams) {
  return useQuery({
    queryKey: [
      'available-subscriptions',
      { page, limit, search: (search ?? '').trim(), sortBy, sortOrder },
    ],
    queryFn: () => listAvailableSubscriptions({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
