import { useMutation, useQueryClient } from '@tanstack/react-query'

import { markNotificationRead } from '../api/notifications'

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification'] }),
  })
}
