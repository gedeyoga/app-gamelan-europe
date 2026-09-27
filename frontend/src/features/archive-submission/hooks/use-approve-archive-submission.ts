import { useMutation, useQueryClient } from '@tanstack/react-query'

import { approveArchiveSubmission } from '../api/archive-submissions'

export function useApproveArchiveSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: approveArchiveSubmission,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['archive-submissions'] })
      void qc.invalidateQueries({ queryKey: ['archive'] })
    },
  })
}
