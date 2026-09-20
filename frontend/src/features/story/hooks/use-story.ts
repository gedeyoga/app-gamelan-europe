import { useQuery } from '@tanstack/react-query'

import { getPost } from '../api/posts'

export function useStory(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['story', { id }],
    queryFn: () => getPost(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  })
}
