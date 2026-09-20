import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { Subscription } from '../types'

/** Current active subscription for the logged-in user, or `null` bila tidak ada. */
export function getMySubscription(): Promise<Subscription | null> {
  return request<Subscription | null>('/subscriptions/me')
}

export type ListAvailableSubscriptionsParams = ListParams

export function listAvailableSubscriptions(
  params: ListAvailableSubscriptionsParams,
): Promise<ListResult<Subscription>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  return requestList<Subscription>(`/subscriptions/available?${search.toString()}`)
}
