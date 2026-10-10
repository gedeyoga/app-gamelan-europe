import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type {
  ApproveSubscriptionRequestInput,
  CreateMySubscriptionRequestInput,
  SubscriptionRequest,
} from '../types'

export interface ListSubscriptionRequestsParams extends ListParams {
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'PENDING' }`). */
  filter?: Record<string, string>
}

function buildQuery(params: ListSubscriptionRequestsParams): string {
  const search = new URLSearchParams()
  appendListParams(search, params)
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    search.set(`filter[${key}]`, value)
  }
  return search.toString()
}

/** Daftar request langganan (admin). */
export function listSubscriptionRequests(
  params: ListSubscriptionRequestsParams,
): Promise<ListResult<SubscriptionRequest>> {
  return requestList<SubscriptionRequest>(`/subscription-requests?${buildQuery(params)}`)
}

export function getSubscriptionRequest(id: string): Promise<SubscriptionRequest> {
  return request<SubscriptionRequest>(`/subscription-requests/${id}`)
}

/** Setujui request; `note`/`paymentProofUrl` opsional (bukti dari `POST /billings/payment-proof`). */
export function approveSubscriptionRequest(
  id: string,
  payload: ApproveSubscriptionRequestInput = {},
): Promise<SubscriptionRequest> {
  return request<SubscriptionRequest>(`/subscription-requests/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/** Tolak request; `note` opsional. */
export function rejectSubscriptionRequest(id: string, note?: string): Promise<SubscriptionRequest> {
  return request<SubscriptionRequest>(`/subscription-requests/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note ? { note } : {}),
  })
}

/** Request langganan milik user login. */
export function listMySubscriptionRequests(
  params: ListParams,
): Promise<ListResult<SubscriptionRequest>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  return requestList<SubscriptionRequest>(`/subscription-requests/me?${search.toString()}`)
}

/** Ajukan request langganan (self-service). */
export function createMySubscriptionRequest(
  payload: CreateMySubscriptionRequestInput,
): Promise<SubscriptionRequest> {
  return request<SubscriptionRequest>('/subscription-requests/me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
