import { useMutation, useQueryClient } from '@tanstack/react-query'

import { bulkUpdateNetworkStatus } from '../api/networks'

export function useBulkUpdateNetworkStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: bulkUpdateNetworkStatus,
    onSettled: () => qc.invalidateQueries({ queryKey: ['network'] }),
  })
}
