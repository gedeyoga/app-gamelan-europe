import { useQuery } from '@tanstack/react-query'

import { listEventTypes } from '../api/event-types'

/**
 * Opsi tipe event. `enabled` di-inject container dari permission
 * `event-type:read` (hook tidak tahu auth).
 */
export function useEventTypes(enabled = true) {
  return useQuery({
    queryKey: ['event-types'],
    queryFn: listEventTypes,
    enabled,
    staleTime: 60_000,
  })
}
