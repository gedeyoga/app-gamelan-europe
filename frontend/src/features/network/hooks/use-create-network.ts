import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createNetwork } from '../api/networks'

export function useCreateNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createNetwork,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network'] }),
  })
}
