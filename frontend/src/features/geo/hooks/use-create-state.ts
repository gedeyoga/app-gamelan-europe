import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createState } from '../api/geo'

export function useCreateState() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createState,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geo', 'states'] }),
  })
}
