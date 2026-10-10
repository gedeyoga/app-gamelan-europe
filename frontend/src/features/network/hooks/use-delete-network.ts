import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteNetwork } from '../api/networks'

export function useDeleteNetwork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteNetwork,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network'] }),
  })
}
