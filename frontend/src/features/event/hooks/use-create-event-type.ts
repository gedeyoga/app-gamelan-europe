import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createEventType } from '../api/event-types'

export function useCreateEventType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createEventType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-types'] }),
  })
}
