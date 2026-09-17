import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteRole } from '../api/roles-api'

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}