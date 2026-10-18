export type NotificationType =
  | 'CONTENT_PUBLISHED'
  | 'CONTENT_SUBMITTED'
  | 'SUBSCRIPTION_REQUEST_SUBMITTED'

export type NotificationEntityType = 'POST' | 'EVENT' | 'ARCHIVE'

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'

export interface NotificationItem {
  id: string
  type: NotificationType
  entityType: NotificationEntityType
  entityId: string
  title: string
  body: string
  linkPath: string | null
  readAt: string | null
  createdAt: string
}

export interface ListNotificationsParams {
  page: number
  limit: number
  status?: NotificationStatus
  /** `true` → hanya yang belum dibaca. */
  unread?: boolean
}

export interface NotificationPreference {
  type: NotificationType
  channel: 'EMAIL'
  emailEnabled: boolean
}
