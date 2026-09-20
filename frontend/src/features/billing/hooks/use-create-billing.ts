import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createBilling } from '../api/billings'

export function useCreateBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBilling,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billings'] }),
  })
}
