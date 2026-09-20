import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listMyBillings } from '../api/my-billings'

export interface UseMyBillingsParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

export function useMyBillings({ page, limit, search, sortBy, sortOrder }: UseMyBillingsParams) {
  return useQuery({
    queryKey: ['my-billings', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listMyBillings({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
