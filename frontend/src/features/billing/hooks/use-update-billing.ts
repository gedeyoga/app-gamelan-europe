import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateBilling } from '../api/billings'
import type { UpdateBillingInput } from '../types'

export function useUpdateBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBillingInput }) =>
      updateBilling(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billings'] }),
  })
}
