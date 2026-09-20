import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listBillings } from '../api/billings'

export interface UseBillingsParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

export function useBillings({ page, limit, search, sortBy, sortOrder }: UseBillingsParams) {
  return useQuery({
    queryKey: ['billings', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listBillings({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
