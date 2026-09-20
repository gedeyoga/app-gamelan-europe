import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteApiKey } from '../api/api-keys'

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-key'] }),
  })
}
