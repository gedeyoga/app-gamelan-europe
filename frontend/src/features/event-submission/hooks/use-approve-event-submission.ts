import { useMutation, useQueryClient } from '@tanstack/react-query'

import { approveEventSubmission } from '../api/event-submissions'

export function useApproveEventSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: approveEventSubmission,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['event-submissions'] })
      void qc.invalidateQueries({ queryKey: ['event'] })
    },
  })
}
