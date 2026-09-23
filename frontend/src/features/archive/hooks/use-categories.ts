import { useQuery } from '@tanstack/react-query'

import { listArchiveCategories } from '../api/categories'

/**
 * Opsi kategori arsip. `enabled` di-inject container dari permission
 * `category:read` (hook tidak tahu auth).
 */
export function useCategories(enabled = true) {
  return useQuery({
    queryKey: ['categories', { type: 'ARCHIVE' }],
    queryFn: listArchiveCategories,
    enabled,
    staleTime: 60_000,
  })
}
