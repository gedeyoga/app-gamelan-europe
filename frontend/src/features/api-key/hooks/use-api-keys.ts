import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listApiKeys } from '../api/api-keys'

export interface UseApiKeysParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

export function useApiKeys(params: UseApiKeysParams = {}) {
  const { page = 1, limit = 10, search, sortBy, sortOrder } = params
  return useQuery({
    queryKey: ['api-key', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listApiKeys({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
