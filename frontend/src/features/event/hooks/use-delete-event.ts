import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteEvent } from '../api/events'

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event'] }),
  })
}
