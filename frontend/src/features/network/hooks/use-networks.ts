import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listNetworks } from '../api/networks'

export interface UseNetworksParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  /** Filter generik `filter[<key>]=<value>` (diteruskan ke `GET /networks`). */
  filter?: Record<string, string>
  enabled?: boolean
}

export function useNetworks({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  filter,
  enabled,
}: UseNetworksParams) {
  return useQuery({
    queryKey: [
      'network',
      { page, limit, search: (search ?? '').trim(), sortBy, sortOrder, filter },
    ],
    queryFn: () => listNetworks({ page, limit, search, sortBy, sortOrder, filter }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
