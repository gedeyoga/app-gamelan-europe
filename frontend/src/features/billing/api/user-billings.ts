import { requestList, type ListResult } from '@/lib/api-client'

import type { Billing } from '../types'

export interface ListUserBillingsParams {
  userId: string
  page: number
  limit: number
}

/** Riwayat billing milik satu user (filter userId, endpoint list billing existing). */
export function listUserBillings({
  userId,
  page,
  limit,
}: ListUserBillingsParams): Promise<ListResult<Billing>> {
  const search = new URLSearchParams()
  search.set('filter[userId]', userId)
  search.set('page', String(page))
  search.set('limit', String(limit))
  return requestList<Billing>(`/billings?${search.toString()}`)
}
