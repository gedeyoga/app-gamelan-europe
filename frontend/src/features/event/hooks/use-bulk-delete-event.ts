import { useMutation, useQueryClient } from '@tanstack/react-query'

import { bulkDeleteEvents } from '../api/events'

export function useBulkDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: bulkDeleteEvents,
    onSettled: () => qc.invalidateQueries({ queryKey: ['event'] }),
  })
}
