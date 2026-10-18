import { useQuery } from '@tanstack/react-query'

import { isUuid } from '@/lib/uuid'

import { getArchive, getArchiveBySlug } from '../api/archives'

export function useArchive(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['archive', { id }],
    queryFn: () =>
      isUuid(id as string) ? getArchive(id as string) : getArchiveBySlug(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  })
}
