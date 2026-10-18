import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { listNotifications } from '../api/notifications'
import type { ListNotificationsParams } from '../types'

export function useNotifications(params: ListNotificationsParams) {
  return useQuery({
    queryKey: ['notification', params],
    queryFn: () => listNotifications(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}
