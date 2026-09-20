import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateEvent } from '../api/events'
import type { UpdateEventInput } from '../types'

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEventInput }) =>
      updateEvent(id, payload),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['event'] })
      void qc.invalidateQueries({ queryKey: ['event', { id: variables.id }] })
    },
  })
}
