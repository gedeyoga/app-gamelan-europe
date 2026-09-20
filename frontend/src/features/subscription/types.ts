export type SubscriptionType = 'MONTHLY' | 'YEARLY'

export interface Subscription {
  id: string
  name: string
  slug: string
  subscriptionType: SubscriptionType
  currency: string
  createdAt: string
  updatedAt: string
}

export interface CreateSubscriptionInput {
  name: string
  slug: string
  subscriptionType: SubscriptionType
  currency: string
}

export type UpdateSubscriptionInput = Partial<CreateSubscriptionInput>

export const SUBSCRIPTION_TYPES: readonly SubscriptionType[] = ['MONTHLY', 'YEARLY']

// Mirror SUBSCRIPTION_SORT_FIELDS backend.
export const SUBSCRIPTION_SORTABLE_FIELDS = [
  'name',
  'slug',
  'subscriptionType',
  'currency',
  'createdAt',
  'updatedAt',
] as const
