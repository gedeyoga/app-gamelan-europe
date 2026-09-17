import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateProfile } from '../api/profile-api'

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      // BE return entity lengkap di response; setQueryData cukup — tidak butuh refetch
      // (pola lebih efisien dari users/roles yang invalidate).
      qc.setQueryData(['auth', 'me'], updated)
    },
  })
}