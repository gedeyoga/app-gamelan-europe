import { useMutation, useQueryClient } from '@tanstack/react-query'

import { approveStory } from '../api/posts'

export function useApproveStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, publishedAt }: { id: string; publishedAt: string }) =>
      approveStory(id, publishedAt),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['story'] })
      void qc.invalidateQueries({ queryKey: ['story', { id }] })
    },
  })
}
