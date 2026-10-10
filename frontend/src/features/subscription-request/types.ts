export type SubscriptionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type SubscriptionRequestType = 'NEW' | 'RENEWAL'

export const SUBSCRIPTION_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export const SUBSCRIPTION_REQUEST_TYPES = ['NEW', 'RENEWAL'] as const

// Mirror kolom sortable backend.
export const SUBSCRIPTION_REQUEST_SORTABLE_FIELDS = [
  'fullName',
  'email',
  'status',
  'requestType',
  'createdAt',
  'updatedAt',
  'reviewedAt',
  'subscription.name',
] as const

export interface SubscriptionRequestSubscription {
  id: string
  name: string
  slug: string
  subscriptionType: 'MONTHLY' | 'YEARLY'
  currency: string
  price: number
  durationInDays: number
}

export interface SubscriptionRequestUser {
  id: string
  fullName: string
  email: string
}

export interface SubscriptionRequestReviewer {
  id: string
  fullName: string
}

export interface SubscriptionRequest {
  id: string
  fullName: string
  email: string
  phone: string | null
  website: string | null
  address: string | null
  country: string | null
  organisation: string | null
  reason: string
  requestType: SubscriptionRequestType
  status: SubscriptionRequestStatus
  subscription: SubscriptionRequestSubscription
  user: SubscriptionRequestUser | null
  reviewedBy: SubscriptionRequestReviewer | null
  reviewedAt: string | null
  reviewNote: string | null
  billingId: string | null
  createdAt: string
  updatedAt: string
}

/** Payload `POST /subscription-requests/me` (self-service). */
export interface CreateMySubscriptionRequestInput {
  subscriptionId: string
  reason: string
  phone?: string
  website?: string
  address?: string
  country?: string
  organisation?: string
}

/** Hasil `POST /billings/payment-proof` (multipart `file`). */
export interface SubscriptionRequestPaymentProof {
  url: string
  filename: string
  mimeType: string
  size: number
}

/** Payload `POST /subscription-requests/:id/approve` — bukti opsional. */
export interface ApproveSubscriptionRequestInput {
  note?: string
  paymentProofUrl?: string
  paymentProofName?: string
}

/** Opsi paket untuk dialog request (dipetakan dari katalog Subscription). */
export interface SubscriptionRequestPlanOption {
  id: string
  name: string
  subscriptionType: 'MONTHLY' | 'YEARLY'
  currency: string
  price: number
  durationInDays: number
}
