import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteSubscription } from '../api/subscriptions'

export function useDeleteSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}
