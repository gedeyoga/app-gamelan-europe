import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createRole } from '../api/roles-api'

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}