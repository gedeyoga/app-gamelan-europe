import { useMutation, useQueryClient } from '@tanstack/react-query'

import { bulkUpdateArchiveStatus } from '../api/archives'

export function useBulkUpdateArchiveStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: bulkUpdateArchiveStatus,
    onSettled: () => qc.invalidateQueries({ queryKey: ['archive'] }),
  })
}
