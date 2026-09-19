import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createPost } from '../api/posts'

export function useCreateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['story'] }),
  })
}
