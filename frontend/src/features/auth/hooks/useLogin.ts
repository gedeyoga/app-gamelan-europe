import { useMutation } from '@tanstack/react-query'

import { login } from '../api/authApi'
import { useAuth } from '../auth-provider'

export function useLogin() {
  const { login: storeAuth, hydrateSession } = useAuth()

  return useMutation({
    mutationFn: login,
    onSuccess: async (auth) => {
      storeAuth(auth)
      try {
        await hydrateSession()
      } catch {
        // Gagal hidrasi (network/401): gate permission akan menolak ke /403
        // hingga `AuthProvider.initialize` (GET /auth/me saat reload) sukses.
      }
    },
  })
}