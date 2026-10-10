import { useMutation, useQueryClient } from '@tanstack/react-query'

import { submitStory } from '../api/posts'

export function useSubmitStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: submitStory,
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['story'] })
      void qc.invalidateQueries({ queryKey: ['story', { id }] })
    },
  })
}
