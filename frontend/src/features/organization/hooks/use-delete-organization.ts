import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteOrganization } from '../api/organizations'

export function useDeleteOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  })
}
