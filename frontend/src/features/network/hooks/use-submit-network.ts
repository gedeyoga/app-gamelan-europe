import { useMutation, useQueryClient } from '@tanstack/react-query'

import { submitNetwork } from '../api/networks'

export function useSubmitNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: submitNetwork,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['network'] })
    },
  })
}
