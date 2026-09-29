export type BillingStatus = 'PENDING' | 'PAID' | 'CANCELED'
export type BillingSubscriptionType = 'MONTHLY' | 'YEARLY'
export type BillingLineType = 'ITEM' | 'DISCOUNT' | 'TAX'

export interface BillingUser {
  id: string
  fullName: string
  email: string
}

export interface BillingNetwork {
  id: string
  name: string
}

export interface BillingSubscription {
  id: string
  name: string
  slug: string
}

export interface BillingLine {
  id: string
  description: string
  type: BillingLineType
  qty: number
  amount: number
  currency: string
}

export interface Billing {
  id: string
  userId: string
  user: BillingUser
  networkId: string | null
  network: BillingNetwork | null
  subscriptionId: string
  subscription: BillingSubscription
  code: string
  status: BillingStatus
  subscriptionType: BillingSubscriptionType
  currency: string
  total: number
  discount: number | null
  tax: number | null
  paidAt: string | null
  canceledAt: string | null
  lines: BillingLine[]
  createdAt: string
  updatedAt: string
}

export interface BillingLineInput {
  description: string
  type: BillingLineType
  qty?: number
  amount: number
  currency: string
}

export interface CreateBillingInput {
  userId: string
  /** `null` = disconnect network; `undefined` = biarkan. */
  networkId?: string | null
  subscriptionId: string
  code: string
  status?: BillingStatus
  subscriptionType: BillingSubscriptionType
  currency: string
  total: number
  /** `null` = clear discount; `undefined` = biarkan. */
  discount?: number | null
  /** `null` = clear tax; `undefined` = biarkan. */
  tax?: number | null
  /** `null` = clear paidAt; ISO UTC bila diisi. */
  paidAt?: string | null
  /** `null` = clear canceledAt; ISO UTC bila diisi. */
  canceledAt?: string | null
  /** Update: `lines` menggantikan seluruh baris lama. */
  lines: BillingLineInput[]
}

export type UpdateBillingInput = Partial<CreateBillingInput>

export const BILLING_STATUSES: readonly BillingStatus[] = ['PENDING', 'PAID', 'CANCELED']
export const BILLING_SUBSCRIPTION_TYPES: readonly BillingSubscriptionType[] = ['MONTHLY', 'YEARLY']
export const BILLING_LINE_TYPES: readonly BillingLineType[] = ['ITEM', 'DISCOUNT', 'TAX']
