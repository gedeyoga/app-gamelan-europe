import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createCategory } from '../api/categories'

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
