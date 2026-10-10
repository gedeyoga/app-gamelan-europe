import { useQuery } from '@tanstack/react-query'

import { getSubscriptionRequest } from '../api/subscription-requests'

export function useSubscriptionRequest(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['subscription-request', { id }],
    queryFn: () => getSubscriptionRequest(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  })
}
