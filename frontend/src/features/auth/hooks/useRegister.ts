import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { register } from '../api/authApi'

export function useRegister() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: register,
    onSuccess: () => {
      navigate('/login', { replace: true })
    },
  })
}
