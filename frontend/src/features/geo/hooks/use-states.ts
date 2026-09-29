import { useQuery } from '@tanstack/react-query'

import { listStatesByCountry } from '../api/geo'

export function useStates(iso2: string) {
  return useQuery({
    queryKey: ['geo', 'states', iso2],
    queryFn: () => listStatesByCountry(iso2),
    enabled: Boolean(iso2),
    staleTime: 60 * 60 * 1000,
  })
}
