import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createArchive } from '../api/archives'

export function useCreateArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createArchive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['archive'] }),
  })
}
