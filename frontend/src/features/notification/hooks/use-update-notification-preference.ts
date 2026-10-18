import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateNotificationPreference } from '../api/notifications'
import type { NotificationType } from '../types'

export function useUpdateNotificationPreference() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ type, emailEnabled }: { type: NotificationType; emailEnabled: boolean }) =>
      updateNotificationPreference(type, emailEnabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification', 'preferences'] }),
  })
}
