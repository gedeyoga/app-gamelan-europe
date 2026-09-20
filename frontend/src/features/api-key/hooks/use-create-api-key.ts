import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createApiKey } from '../api/api-keys'

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-key'] }),
  })
}
