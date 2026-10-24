import { useMutation, useQueryClient } from '@tanstack/react-query'

import { bulkUpdateEventStatus } from '../api/events'

export function useBulkUpdateEventStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: bulkUpdateEventStatus,
    onSettled: () => qc.invalidateQueries({ queryKey: ['event'] }),
  })
}
