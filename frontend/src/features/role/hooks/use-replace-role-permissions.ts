import { useMutation, useQueryClient } from '@tanstack/react-query'

import { replaceRolePermissions } from '../api/roles-api'

export function useReplaceRolePermissions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      replaceRolePermissions(roleId, permissionIds),
    onSuccess: (_, { roleId }) => {
      qc.invalidateQueries({ queryKey: ['roles', roleId, 'permissions'] })
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })
}