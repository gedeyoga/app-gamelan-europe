import { useQuery } from '@tanstack/react-query'

import { listCategories } from '../api/categories'

/**
 * Opsi kategori story. `enabled` di-inject container dari permission
 * `category:read` (hook tidak tahu auth).
 */
export function useCategories(enabled = true) {
  return useQuery({
    queryKey: ['categories', { type: 'STORY' }],
    queryFn: listCategories,
    enabled,
    staleTime: 60_000,
  })
}
