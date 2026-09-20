import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateOrganization } from '../api/organizations'
import type { UpdateOrganizationInput } from '../types'

export function useUpdateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOrganizationInput }) =>
      updateOrganization(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  })
}
