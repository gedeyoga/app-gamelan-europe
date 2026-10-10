export type SubscriptionType = 'MONTHLY' | 'YEARLY'

export type SubscriptionStatus = 'ACTIVE' | 'INACTIVE'

export const SUBSCRIPTION_STATUSES = ['ACTIVE', 'INACTIVE'] as const

export const SUBSCRIPTION_CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD', 'MYR'] as const
export type SubscriptionCurrency = (typeof SUBSCRIPTION_CURRENCIES)[number]

export interface Subscription {
  id: string
  name: string
  slug: string
  subscriptionType: SubscriptionType
  status: SubscriptionStatus
  currency: string
  /** Decimal 12,2 — dikirim BE sebagai number. */
  price: number
  /** Durasi paket dalam hari (integer, min 1). */
  durationInDays: number
  /** Jumlah user unik dengan billing PAID pada paket ini. */
  subscriberCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateSubscriptionInput {
  name: string
  slug: string
  subscriptionType: SubscriptionType
  status: SubscriptionStatus
  currency: string
  price: number
  durationInDays: number
}

export type UpdateSubscriptionInput = Partial<CreateSubscriptionInput>

export const SUBSCRIPTION_TYPES: readonly SubscriptionType[] = ['MONTHLY', 'YEARLY']

// Mirror SUBSCRIPTION_SORT_FIELDS backend.
export const SUBSCRIPTION_SORTABLE_FIELDS = [
  'name',
  'slug',
  'subscriptionType',
  'status',
  'currency',
  'price',
  'durationInDays',
  'createdAt',
  'updatedAt',
] as const
