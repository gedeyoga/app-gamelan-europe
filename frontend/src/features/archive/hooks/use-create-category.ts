import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createArchiveCategory } from '../api/categories'

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createArchiveCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
