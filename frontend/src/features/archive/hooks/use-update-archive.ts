import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateArchive } from '../api/archives'
import type { UpdateArchiveInput } from '../types'

export function useUpdateArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateArchiveInput }) =>
      updateArchive(id, payload),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['archive'] })
      void qc.invalidateQueries({ queryKey: ['archive', { id: variables.id }] })
    },
  })
}
