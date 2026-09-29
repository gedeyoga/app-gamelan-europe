import { useQuery } from '@tanstack/react-query'

import { listCountries } from '../api/geo'

export function useCountries() {
  return useQuery({
    queryKey: ['geo', 'countries'],
    queryFn: listCountries,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
