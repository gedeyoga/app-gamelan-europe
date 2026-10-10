import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateNetwork } from '../api/networks'
import type { UpdateNetworkInput } from '../types'

export function useUpdateNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateNetworkInput }) =>
      updateNetwork(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['network'] })
      qc.invalidateQueries({ queryKey: ['network', { id }] })
    },
  })
}
