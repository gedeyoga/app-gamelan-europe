export type NotificationType =
  | 'CONTENT_PUBLISHED'
  | 'CONTENT_SUBMITTED'
  | 'SUBSCRIPTION_REQUEST_SUBMITTED'
  | 'SUBSCRIPTION_ACTIVE'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_CANCELED'

export interface NotificationPreference {
  type: NotificationType
  channel: 'EMAIL'
  emailEnabled: boolean
}
