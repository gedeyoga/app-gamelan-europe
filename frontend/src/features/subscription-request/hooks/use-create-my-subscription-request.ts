import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createMySubscriptionRequest } from '../api/subscription-requests'

export function useCreateMySubscriptionRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMySubscriptionRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-subscription-requests'] })
    },
  })
}
