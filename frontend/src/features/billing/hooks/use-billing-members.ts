import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { getMembers } from '../api/members'

export interface UseBillingMembersParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

export function useBillingMembers({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
}: UseBillingMembersParams) {
  return useQuery({
    queryKey: [
      'billing-members',
      { page, limit, search: (search ?? '').trim(), sortBy, sortOrder },
    ],
    queryFn: () => getMembers({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
