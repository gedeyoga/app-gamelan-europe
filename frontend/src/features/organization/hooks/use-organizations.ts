import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listOrganizations } from '../api/organizations'

export interface UseOrganizationsParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  enabled?: boolean
}

export function useOrganizations({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  enabled,
}: UseOrganizationsParams) {
  return useQuery({
    queryKey: ['organizations', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listOrganizations({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
