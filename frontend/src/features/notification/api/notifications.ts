import { request, requestList, type ListResult } from '@/lib/api-client'

import type {
  ListNotificationsParams,
  NotificationItem,
  NotificationPreference,
  NotificationType,
} from '../types'

export function listNotifications(
  params: ListNotificationsParams,
): Promise<ListResult<NotificationItem>> {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  })
  if (params.status) search.set('status', params.status)
  if (params.unread !== undefined) search.set('unread', String(params.unread))
  return requestList<NotificationItem>(`/notifications?${search.toString()}`)
}

export function markNotificationRead(id: string): Promise<NotificationItem> {
  return request<NotificationItem>(`/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return request<{ updated: number }>('/notifications/read-all', { method: 'POST' })
}

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
