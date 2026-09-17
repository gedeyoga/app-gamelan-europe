import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateRole } from '../api/roles-api'

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateRole>[1] }) =>
      updateRole(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}