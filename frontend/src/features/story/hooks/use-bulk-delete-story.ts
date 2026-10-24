import { useMutation, useQueryClient } from '@tanstack/react-query'

import { bulkDeletePosts } from '../api/posts'

export function useBulkDeleteStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: bulkDeletePosts,
    onSettled: () => qc.invalidateQueries({ queryKey: ['story'] }),
  })
}
