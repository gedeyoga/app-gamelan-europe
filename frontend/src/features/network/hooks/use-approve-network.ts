import { useMutation, useQueryClient } from '@tanstack/react-query'

import { approveNetwork } from '../api/networks'

export function useApproveNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, publishedAt }: { id: string; publishedAt?: string }) =>
      approveNetwork(id, publishedAt),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['network'] })
      void qc.invalidateQueries({ queryKey: ['network', { id }] })
    },
  })
}
