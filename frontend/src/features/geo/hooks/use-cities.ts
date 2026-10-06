import { useQuery } from '@tanstack/react-query'

import { listCitiesByCountry } from '../api/geo'

export function useCities({ countryId, stateId }: { countryId?: number; stateId?: number }) {
  return useQuery({
    queryKey: ['geo', 'cities', countryId, stateId],
    queryFn: () => listCitiesByCountry({ countryId: countryId as number, stateId }),
    enabled: Boolean(countryId && stateId),
    staleTime: 60 * 60 * 1000,
  })
}
