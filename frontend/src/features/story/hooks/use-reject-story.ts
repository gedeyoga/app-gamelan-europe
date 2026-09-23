import { useMutation, useQueryClient } from '@tanstack/react-query'

import { rejectStory } from '../api/posts'

export function useRejectStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rejectStory,
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['story'] })
      void qc.invalidateQueries({ queryKey: ['story', { id }] })
    },
  })
}
