import { request, requestList } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type {
  CreateSubscriptionInput,
  Subscription,
  UpdateSubscriptionInput,
} from '../types'

export type ListSubscriptionsParams = ListParams

export interface SubscriptionListResult {
  items: Subscription[]
  page: number
  limit: number
  total: number
}

export function listSubscriptions(params: ListSubscriptionsParams): Promise<SubscriptionListResult> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  return requestList<Subscription>(`/subscriptions?${search.toString()}`)
}

export function createSubscription(payload: CreateSubscriptionInput): Promise<Subscription> {
  return request<Subscription>('/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateSubscription(
  id: string,
  payload: UpdateSubscriptionInput,
): Promise<Subscription> {
  return request<Subscription>(`/subscriptions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteSubscription(id: string): Promise<Subscription> {
  return request<Subscription>(`/subscriptions/${id}`, { method: 'DELETE' })
}
