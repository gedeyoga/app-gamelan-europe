import { useMutation, useQueryClient } from '@tanstack/react-query'

import { submitArchive } from '../api/archives'

export function useSubmitArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: submitArchive,
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['archive'] })
      void qc.invalidateQueries({ queryKey: ['archive', { id }] })
    },
  })
}
