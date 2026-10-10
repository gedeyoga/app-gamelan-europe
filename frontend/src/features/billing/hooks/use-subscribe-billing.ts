import { useMutation, useQueryClient } from '@tanstack/react-query'

import { subscribeBilling } from '../api/subscribe'

export function useSubscribeBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: subscribeBilling,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-members'] })
      qc.invalidateQueries({ queryKey: ['user-billings'] })
      qc.invalidateQueries({ queryKey: ['my-billings'] })
      // subscriberCount katalog plan ikut berubah setelah subscribe.
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}
