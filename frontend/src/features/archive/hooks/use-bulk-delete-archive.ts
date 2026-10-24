import { useMutation, useQueryClient } from '@tanstack/react-query'

import { bulkDeleteArchives } from '../api/archives'

export function useBulkDeleteArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: bulkDeleteArchives,
    onSettled: () => qc.invalidateQueries({ queryKey: ['archive'] }),
  })
}
