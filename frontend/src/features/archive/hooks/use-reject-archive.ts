import { useMutation, useQueryClient } from '@tanstack/react-query'

import { rejectArchive } from '../api/archives'

export function useRejectArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rejectArchive,
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['archive'] })
      void qc.invalidateQueries({ queryKey: ['archive', { id }] })
    },
  })
}
