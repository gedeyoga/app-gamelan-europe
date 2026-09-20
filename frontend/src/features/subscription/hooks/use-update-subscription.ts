import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateSubscription } from '../api/subscriptions'
import type { UpdateSubscriptionInput } from '../types'

export function useUpdateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSubscriptionInput }) =>
      updateSubscription(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}
