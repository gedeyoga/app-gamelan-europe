import { useMutation, useQueryClient } from '@tanstack/react-query'

import { markAllNotificationsRead } from '../api/notifications'

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification'] }),
  })
}
