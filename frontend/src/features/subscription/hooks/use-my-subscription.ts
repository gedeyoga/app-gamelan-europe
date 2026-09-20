import { useQuery } from '@tanstack/react-query'

import { getMySubscription } from '../api/my-subscription'

export function useMySubscription() {
  return useQuery({
    queryKey: ['my-subscription'],
    queryFn: getMySubscription,
    staleTime: 30_000,
  })
}
