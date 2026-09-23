import { useMutation, useQueryClient } from '@tanstack/react-query'

import { rejectEvent } from '../api/events'

export function useRejectEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rejectEvent,
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['event'] })
      void qc.invalidateQueries({ queryKey: ['event', { id }] })
    },
  })
}
