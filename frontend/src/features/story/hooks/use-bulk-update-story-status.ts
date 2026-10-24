import { useMutation, useQueryClient } from '@tanstack/react-query'

import { bulkUpdatePostStatus } from '../api/posts'

export function useBulkUpdateStoryStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: bulkUpdatePostStatus,
    onSettled: () => qc.invalidateQueries({ queryKey: ['story'] }),
  })
}
