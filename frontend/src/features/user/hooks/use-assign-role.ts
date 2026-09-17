import { useMutation, useQueryClient } from '@tanstack/react-query'

import { assignRole } from '../api/users-api'

export function useAssignRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      assignRole(userId, roleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}