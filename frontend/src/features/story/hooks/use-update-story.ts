import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updatePost } from '../api/posts'
import type { UpdateStoryInput } from '../types'

export function useUpdateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStoryInput }) =>
      updatePost(id, payload),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['story'] })
      void qc.invalidateQueries({ queryKey: ['story', { id: variables.id }] })
    },
  })
}
