import { useMutation, useQueryClient } from '@tanstack/react-query'

import { approveStorySubmission } from '../api/story-submissions'

export function useApproveStorySubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: approveStorySubmission,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['story-submissions'] })
      void qc.invalidateQueries({ queryKey: ['story-submission'] })
      void qc.invalidateQueries({ queryKey: ['story'] })
    },
  })
}
