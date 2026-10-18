import { useMutation, useQueryClient } from '@tanstack/react-query'

import { approveEvent } from '../api/events'

export function useApproveEvent() {
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
    }) => approveEvent(id, publishedAt, notify),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['event'] })
      void qc.invalidateQueries({ queryKey: ['event', { id }] })
    },
  })
}
