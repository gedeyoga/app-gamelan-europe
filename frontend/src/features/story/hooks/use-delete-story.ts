import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deletePost } from '../api/posts'

export function useDeleteStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['story'] }),
  })
}
