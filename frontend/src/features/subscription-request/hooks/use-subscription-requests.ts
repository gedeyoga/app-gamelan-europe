import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listSubscriptionRequests } from '../api/subscription-requests'

export interface UseSubscriptionRequestsParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'PENDING' }`). */
  filter?: Record<string, string>
  enabled?: boolean
}

export function useSubscriptionRequests({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  filter,
  enabled,
}: UseSubscriptionRequestsParams) {
  return useQuery({
    queryKey: [
      'subscription-requests',
      { page, limit, search: (search ?? '').trim(), sortBy, sortOrder, filter },
    ],
    queryFn: () => listSubscriptionRequests({ page, limit, search, sortBy, sortOrder, filter }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
