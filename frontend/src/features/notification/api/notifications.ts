import { request } from '@/lib/api-client'

import type { NotificationPreference, NotificationType } from '../types'

export function getNotificationPreferences(): Promise<NotificationPreference[]> {
  return request<NotificationPreference[]>('/notification-preferences')
}

export function updateNotificationPreference(
  type: NotificationType,
  emailEnabled: boolean,
): Promise<NotificationPreference> {
  return request<NotificationPreference>(`/notification-preferences/${type}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailEnabled }),
  })
}
