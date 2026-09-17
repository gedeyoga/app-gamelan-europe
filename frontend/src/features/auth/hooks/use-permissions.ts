import { useMemo } from 'react'

import { useAuth } from '../auth-provider'
import { getPermissions, hasAnyPermission, hasPermission } from '../lib/permissions'

export interface AuthPermissions {
  /** Daftar kode permission milik user sesi (`resource:action`), `[]` bila tamu/tanpa role. */
  permissions: string[]
  /** Cek satu permission, mis. `can('user:read')`. */
  can: (code: string) => boolean
  /** Cek minimal satu dari daftar, mis. `canAny(['user:update', 'user:delete'])`. */
  canAny: (codes: string[]) => boolean
  isAuthenticated: boolean
}

/**
 * Hook otorisasi sesi — baca `useAuth().user` sekali, expose helper `can`/`canAny`.
 * Sumber permission: `GET /auth/me` → `SessionUser.permissions` (disimpan di `localStorage['auth.user']`).
 */
export function useAuthPermissions(): AuthPermissions {
  const { user, isAuthenticated } = useAuth()

  return useMemo<AuthPermissions>(() => {
    const permissions = getPermissions(user)
    return {
      permissions,
      can: (code: string) => hasPermission(user, code),
      canAny: (codes: string[]) => hasAnyPermission(user, codes),
      isAuthenticated,
    }
  }, [user, isAuthenticated])
}
