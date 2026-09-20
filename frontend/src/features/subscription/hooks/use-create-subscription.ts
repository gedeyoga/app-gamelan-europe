import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createSubscription } from '../api/subscriptions'

export function useCreateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}
