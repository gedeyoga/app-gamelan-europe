import { useMutation, useQueryClient } from '@tanstack/react-query'

import { unpublishNetwork } from '../api/networks'

export function useUnpublishNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unpublishNetwork,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['network'] })
    },
  })
}
