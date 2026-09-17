import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { logoutApi } from '../api/authApi'
import { useAuth } from '../auth-provider'

export function useLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout: syncLogout } = useAuth()

  return useMutation({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem('auth.refreshToken')
      await logoutApi(refreshToken ?? undefined)
    },
    onSettled: () => {
      syncLogout()
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })
}
