import { useQuery } from '@tanstack/react-query'

import { getNotificationPreferences } from '../api/notifications'

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification', 'preferences'],
    queryFn: getNotificationPreferences,
    staleTime: 60_000,
  })
}
