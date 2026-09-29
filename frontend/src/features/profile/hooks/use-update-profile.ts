import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/auth-provider'
import type { SessionUser } from '@/features/auth/types'

import { updateProfile } from '../api/profile-api'

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { setSession } = useAuth()
  return useMutation<SessionUser, Error, Parameters<typeof updateProfile>[0]>({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      // BE return entity lengkap di response; setQueryData cukup — tidak butuh refetch.
      // Sinkronkan juga AuthProvider (state + localStorage) agar sidebar/UI tidak stale.
      qc.setQueryData(['auth', 'me'], updated)
      setSession(updated)
    },
  })
}
