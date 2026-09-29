import { useQuery } from '@tanstack/react-query'

import { getNetwork } from '../api/networks'

export function useNetwork(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['network', { id }],
    queryFn: () => getNetwork(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  })
}
