import { useAuth } from '../auth-provider'

/**
 * Single source of truth status membership user sesi (`GET /auth/me` → `SessionUser.isMember`).
 * Fitur lain cukup panggil hook ini; default `false` bila tamu/flag absen.
 */
export function useMembership(): boolean {
  return useAuth().user?.isMember ?? false
}
