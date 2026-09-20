import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateApiKey } from '../api/api-keys'
import type { UpdateApiKeyInput } from '../types'

export function useUpdateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateApiKeyInput }) =>
      updateApiKey(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['api-key'] })
      qc.invalidateQueries({ queryKey: ['api-key', variables.id] })
    },
  })
}
