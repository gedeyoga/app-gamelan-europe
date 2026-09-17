import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteUser } from '../api/users-api'

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}