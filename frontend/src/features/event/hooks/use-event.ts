import { useQuery } from '@tanstack/react-query'

import { getEvent } from '../api/events'

export function useEvent(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['event', { id }],
    queryFn: () => getEvent(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  })
}
