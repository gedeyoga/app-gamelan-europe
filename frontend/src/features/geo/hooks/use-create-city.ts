import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createCity } from '../api/geo'

export function useCreateCity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCity,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geo', 'cities'] }),
  })
}
