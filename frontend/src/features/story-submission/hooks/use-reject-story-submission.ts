import { useMutation, useQueryClient } from '@tanstack/react-query'

import { rejectStorySubmission } from '../api/story-submissions'

export function useRejectStorySubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rejectStorySubmission,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['story-submissions'] })
      void qc.invalidateQueries({ queryKey: ['story-submission'] })
      void qc.invalidateQueries({ queryKey: ['story'] })
    },
  })
}
