import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createEvent } from '../api/events'

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event'] }),
  })
}
