import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listPosts } from '../api/posts'

export interface UseStoriesParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  /** Filter generik `filter[<key>]=<value>` (diteruskan ke `GET /posts`). */
  filter?: Record<string, string>
  /** `false` → query tidak dijalankan (mis. gate admin di dashboard). */
  enabled?: boolean
}

export function useStories({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  filter,
  enabled,
}: UseStoriesParams) {
  return useQuery({
    queryKey: [
      'story',
      { page, limit, search: (search ?? '').trim(), sortBy, sortOrder, filter },
    ],
    queryFn: () => listPosts({ page, limit, search, sortBy, sortOrder, filter }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
