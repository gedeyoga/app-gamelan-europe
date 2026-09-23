import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteArchive } from '../api/archives'

export function useDeleteArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteArchive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['archive'] }),
  })
}
