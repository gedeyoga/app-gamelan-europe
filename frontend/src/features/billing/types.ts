export type BillingStatus = 'PENDING' | 'PAID' | 'CANCELED'
export type BillingSubscriptionType = 'MONTHLY' | 'YEARLY'
export type BillingLineType = 'ITEM' | 'DISCOUNT' | 'TAX'

/** Status langganan member (dihitung backend), bukan status billing. */
export type MemberSubscriptionStatus = 'ACTIVE' | 'INACTIVE' | 'NONE'

export interface BillingUser {
  id: string
  fullName: string
  email: string
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
  subscriptionId: string
  subscription: BillingSubscription
  code: string
  status: BillingStatus
  subscriptionType: BillingSubscriptionType
  currency: string
  total: number
  discount: number | null
  tax: number | null
  startDate: string | null
  expiryDate: string | null
  paidAt: string | null
  canceledAt: string | null
  paymentProofUrl: string | null
  paymentProofName: string | null
  lines: BillingLine[]
  createdAt: string
  updatedAt: string
}

/** Hasil `POST /billings/payment-proof` (multipart `file`). */
export interface PaymentProof {
  url: string
  filename: string
  mimeType: string
  size: number
}

export interface MemberSubscriptionUser {
  id: string
  fullName: string
  email: string
  avatar: string | null
}

export interface MemberSubscription {
  userId: string
  user: MemberSubscriptionUser
  billingId: string | null
  startDate: string | null
  expiryDate: string | null
  subscription: BillingSubscription | null
  status: MemberSubscriptionStatus
}

export interface SubscribeInput {
  userId: string
  subscriptionId: string
  /** URL bukti pembayaran hasil `POST /billings/payment-proof`; opsional. */
  paymentProofUrl?: string
  /** Nama file bukti pembayaran; opsional. */
  paymentProofName?: string
}

/** Opsi paket untuk dialog subscribe/upgrade. Hanya id+name wajib; detail lain tampil bila ada. */
export interface BillingSubscriptionOption {
  id: string
  name: string
  price?: number
  currency?: string
  subscriptionType?: BillingSubscriptionType
  durationInDays?: number
}
