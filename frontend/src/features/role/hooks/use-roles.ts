import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listRoles } from '../api/roles-api'

export interface UseRolesParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

export function useRoles(params: UseRolesParams = {}) {
  const { page = 1, limit = 10, search, sortBy, sortOrder } = params
  return useQuery({
    queryKey: ['roles', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listRoles({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}