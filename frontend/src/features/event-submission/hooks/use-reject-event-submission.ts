import { useMutation, useQueryClient } from '@tanstack/react-query'

import { rejectEventSubmission } from '../api/event-submissions'

export function useRejectEventSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rejectEventSubmission,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['event-submissions'] })
      void qc.invalidateQueries({ queryKey: ['event'] })
    },
  })
}
