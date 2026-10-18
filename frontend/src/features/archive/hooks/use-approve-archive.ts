import { useMutation, useQueryClient } from '@tanstack/react-query'

import { approveArchive } from '../api/archives'

export function useApproveArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      publishedAt,
      notify,
    }: {
      id: string
      publishedAt?: string
      notify?: boolean
    }) => approveArchive(id, publishedAt, notify),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['archive'] })
      void qc.invalidateQueries({ queryKey: ['archive', { id }] })
    },
  })
}
