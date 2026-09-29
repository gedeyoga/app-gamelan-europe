import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { deleteUser, type DeleteUserOptions, type UserListResult } from '../api/users-api'

/** `string` = hapus user saja; objek = bisa ikut cascade konten (author). */
export type DeleteUserVariables = string | { id: string; options?: DeleteUserOptions }

/**
 * Buang user dari cache list `['users', ...]` tanpa refetch (jalur cascade author):
 * `items` difilter, `total` diturunkan agar label pagination tetap benar.
 * Cache domain lain (story/event/archive) sengaja tidak disentuh.
 */
function removeUserFromListCache(qc: QueryClient, id: string) {
  qc.setQueriesData<UserListResult>({ queryKey: ['users'] }, (old) => {
    if (!old?.items.some((user) => user.id === id)) return old
    return {
      ...old,
      items: old.items.filter((user) => user.id !== id),
      total: Math.max(0, old.total - 1),
    }
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (variables: DeleteUserVariables) =>
      typeof variables === 'string'
        ? deleteUser(variables)
        : deleteUser(variables.id, variables.options),
    onSuccess: (deleted, variables) => {
      // Jalur cascade (author picker): list di-update in-place, tanpa refetch.
      if (typeof variables !== 'string' && variables.options?.cascadeContent === true) {
        removeUserFromListCache(qc, deleted.id)
        return
      }
      return qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
