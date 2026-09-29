import { requestList } from '@/lib/api-client'

export interface CountryOption {
  id: number
  name: string
  iso2: string
}

export interface StateOption {
  id: number
  name: string
  countryCode: string
}

const GEO_PAGE_LIMIT = 100

// Endpoint publik; kegagalan load tidak memblokir submit. Backend cap limit=100
// sedangkan dataset lebih besar -> paginasi sampai habis.
export async function listCountries(): Promise<CountryOption[]> {
  const items: CountryOption[] = []
  let page = 1
  for (;;) {
    const res = await requestList<CountryOption>(
      `/countries?page=${page}&limit=${GEO_PAGE_LIMIT}&sortBy=name&sortOrder=asc`,
    )
    items.push(...res.items)
    if (res.items.length < GEO_PAGE_LIMIT || items.length >= res.total) break
    page += 1
  }
  return items
}

export async function listStatesByCountry(iso2: string): Promise<StateOption[]> {
  const items: StateOption[] = []
  let page = 1
  for (;;) {
    const params = new URLSearchParams({
      'filter[countryCode]': iso2,
      page: String(page),
      limit: String(GEO_PAGE_LIMIT),
      sortBy: 'name',
      sortOrder: 'asc',
    })
    const res = await requestList<StateOption>(`/states?${params.toString()}`)
    items.push(...res.items)
    if (res.items.length < GEO_PAGE_LIMIT || items.length >= res.total) break
    page += 1
  }
  return items
}
