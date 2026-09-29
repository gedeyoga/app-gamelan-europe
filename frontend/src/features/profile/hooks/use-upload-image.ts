import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/auth-provider'
import type { SessionUser } from '@/features/auth/types'

import { uploadImage } from '../api/images'

// Server membalas profil lengkap (termasuk `avatar`) — sinkronkan cache + AuthProvider.
export function useUploadImage() {
  const qc = useQueryClient()
  const { setSession } = useAuth()
  return useMutation<SessionUser, Error, File>({
    mutationFn: uploadImage,
    onSuccess: (profile) => {
      qc.setQueryData(['auth', 'me'], profile)
      setSession(profile)
    },
  })
}
