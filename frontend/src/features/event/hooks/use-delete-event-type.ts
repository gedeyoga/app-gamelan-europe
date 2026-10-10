import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteEventType } from '../api/event-types'

export function useDeleteEventType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteEventType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-types'] }),
  })
}
