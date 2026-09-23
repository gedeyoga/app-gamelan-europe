import { useQuery } from '@tanstack/react-query'

import { getArchive } from '../api/archives'

export function useArchive(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['archive', { id }],
    queryFn: () => getArchive(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  })
}
