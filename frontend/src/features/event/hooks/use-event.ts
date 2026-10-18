import { useQuery } from '@tanstack/react-query'

import { isUuid } from '@/lib/uuid'

import { getEvent, getEventBySlug } from '../api/events'

export function useEvent(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['event', { id }],
    queryFn: () =>
      isUuid(id as string) ? getEvent(id as string) : getEventBySlug(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  })
}
