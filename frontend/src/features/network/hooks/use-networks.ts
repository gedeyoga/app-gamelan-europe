import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listNetworks } from '../api/networks'

export interface UseNetworksParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  enabled?: boolean
}

export function useNetworks({ page, limit, search, sortBy, sortOrder, enabled }: UseNetworksParams) {
  return useQuery({
    queryKey: ['networks', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listNetworks({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
