export type NotificationType =
  | 'CONTENT_PUBLISHED'
  | 'CONTENT_SUBMITTED'
  | 'SUBSCRIPTION_REQUEST_SUBMITTED'

export interface NotificationPreference {
  type: NotificationType
  channel: 'EMAIL'
  emailEnabled: boolean
}
