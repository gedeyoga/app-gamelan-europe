import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createUser } from '../api/users-api'

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}