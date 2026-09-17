import { useQuery } from '@tanstack/react-query'

import { listRolePermissions } from '../api/roles-api'

export function useRolePermissions(roleId: string | null) {
  return useQuery({
    queryKey: ['roles', roleId, 'permissions'],
    queryFn: () => listRolePermissions(roleId!),
    enabled: Boolean(roleId),
    staleTime: 30_000,
  })
}