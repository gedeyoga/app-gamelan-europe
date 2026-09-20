import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteBilling } from '../api/billings'

export function useDeleteBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteBilling,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billings'] }),
  })
}
