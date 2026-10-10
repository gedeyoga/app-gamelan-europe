import { useMutation, useQueryClient } from '@tanstack/react-query'

import { approveSubscriptionRequest } from '../api/subscription-requests'
import type { ApproveSubscriptionRequestInput } from '../types'

export type ApproveSubscriptionRequestVariables = { id: string } & ApproveSubscriptionRequestInput

export function useApproveSubscriptionRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: ApproveSubscriptionRequestVariables) =>
      approveSubscriptionRequest(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['subscription-requests'] })
      void qc.invalidateQueries({ queryKey: ['subscription-request', { id }] })
      void qc.invalidateQueries({ queryKey: ['billing'] })
      void qc.invalidateQueries({ queryKey: ['billing-members'] })
    },
  })
}
