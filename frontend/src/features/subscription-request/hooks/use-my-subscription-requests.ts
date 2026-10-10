import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { listMySubscriptionRequests } from '../api/subscription-requests'

export interface UseMySubscriptionRequestsParams {
  page: number
  limit: number
}

export function useMySubscriptionRequests({
  page,
  limit,
}: UseMySubscriptionRequestsParams) {
  return useQuery({
    queryKey: ['my-subscription-requests', { page, limit }],
    queryFn: () => listMySubscriptionRequests({ page, limit }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
