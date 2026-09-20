import { useQuery } from '@tanstack/react-query'

import { listCountries } from '../api/authApi'

/** Daftar negara untuk select register. Endpoint publik; error → select kosong, form tetap submitable. */
export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: listCountries,
    staleTime: 5 * 60_000,
  })
}
