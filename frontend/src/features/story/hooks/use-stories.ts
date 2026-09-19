import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listPosts } from '../api/posts'

export interface UseStoriesParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
}

export function useStories({ page, limit, search, sortBy, sortOrder }: UseStoriesParams) {
  return useQuery({
    queryKey: ['story', { page, limit, search: (search ?? '').trim(), sortBy, sortOrder }],
    queryFn: () => listPosts({ page, limit, search, sortBy, sortOrder }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
