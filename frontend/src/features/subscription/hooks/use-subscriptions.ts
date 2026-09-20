import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listSubscriptions } from '../api/subscriptions'

export interface UseSubscriptionsParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  enabled?: boolean
}

export function useSubscriptions({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  enabled,
}: UseSubscriptionsParams) {
  return useQuery({
    queryKey: ['subscriptions', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listSubscriptions({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
