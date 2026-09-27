import { useMutation, useQueryClient } from '@tanstack/react-query'

import { rejectArchiveSubmission } from '../api/archive-submissions'

export function useRejectArchiveSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rejectArchiveSubmission,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['archive-submissions'] })
      void qc.invalidateQueries({ queryKey: ['archive'] })
    },
  })
}
