import { useMutation, useQueryClient } from '@tanstack/react-query'

import { cancelBilling } from '../api/cancel-billing'

export function useCancelBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelBilling,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-members'] })
      qc.invalidateQueries({ queryKey: ['user-billings'] })
      qc.invalidateQueries({ queryKey: ['my-billings'] })
      // subscriberCount katalog plan ikut berubah setelah cancel.
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}
