import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createOrganization } from '../api/organizations'

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  })
}
