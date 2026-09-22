import { useMutation, useQueryClient } from '@tanstack/react-query'

import { submitEvent } from '../api/events'

export function useSubmitEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: submitEvent,
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['event'] })
      void qc.invalidateQueries({ queryKey: ['event', { id }] })
    },
  })
}
