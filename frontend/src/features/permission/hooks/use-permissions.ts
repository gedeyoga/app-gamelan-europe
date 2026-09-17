import { useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listPermissions } from '../api/permissions-api'

export interface UsePermissionsParams {
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

export function usePermissions(params: UsePermissionsParams = {}) {
  const { search, sortBy, sortOrder } = params
  return useQuery({
    queryKey: ['permissions', { search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listPermissions({ search, sortBy, sortOrder }),
    staleTime: 60_000,
    retry: 1,
  })
}