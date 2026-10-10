import { useMutation, useQueryClient } from '@tanstack/react-query'

import { rejectSubscriptionRequest } from '../api/subscription-requests'

export interface RejectSubscriptionRequestVariables {
  id: string
  note?: string
}

export function useRejectSubscriptionRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: RejectSubscriptionRequestVariables) =>
      rejectSubscriptionRequest(id, note),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['subscription-requests'] })
      void qc.invalidateQueries({ queryKey: ['subscription-request', { id }] })
      void qc.invalidateQueries({ queryKey: ['billing'] })
      void qc.invalidateQueries({ queryKey: ['billing-members'] })
    },
  })
}
