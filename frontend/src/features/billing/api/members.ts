import { requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { MemberSubscription } from '../types'

export type ListBillingMembersParams = ListParams

/** Daftar member + status langganan (agregat backend). */
export function getMembers(
  params: ListBillingMembersParams,
): Promise<ListResult<MemberSubscription>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  return requestList<MemberSubscription>(`/billings/members?${search.toString()}`)
}
