import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listUsers } from '../api/users-api'

export interface UseUsersParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

export function useUsers({ page, limit, search, sortBy, sortOrder }: UseUsersParams) {
  return useQuery({
    queryKey: ['users', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listUsers({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
  })
}