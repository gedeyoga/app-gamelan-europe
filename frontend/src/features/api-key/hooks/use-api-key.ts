import { useQuery } from '@tanstack/react-query'

import { getApiKey } from '../api/api-keys'

/** Detail satu API key (tanpa `key` raw). `enabled` saat `id` tersedia. */
export function useApiKey(id: string | null) {
  return useQuery({
    queryKey: ['api-key', id],
    queryFn: () => getApiKey(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  })
}
