import { requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { Billing } from '../types'

export type ListMyBillingsParams = ListParams

export function listMyBillings(params: ListMyBillingsParams): Promise<ListResult<Billing>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  return requestList<Billing>(`/billings/me?${search.toString()}`)
}
