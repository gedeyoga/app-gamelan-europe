import { useMutation, useQueryClient } from '@tanstack/react-query'

import { rejectNetwork } from '../api/networks'

export function useRejectNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rejectNetwork,
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['network'] })
      void qc.invalidateQueries({ queryKey: ['network', { id }] })
    },
  })
}
