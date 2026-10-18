import { useQuery } from '@tanstack/react-query'

import { isUuid } from '@/lib/uuid'

import { getPost, getPostBySlug } from '../api/posts'

export function useStory(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['story', { id }],
    queryFn: () => (isUuid(id as string) ? getPost(id as string) : getPostBySlug(id as string)),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  })
}
