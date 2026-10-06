import { request, requestList } from '@/lib/api-client'

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

export interface CityOption {
  id: number
  name: string
  countryId: number
}

export interface CreateCityInput {
  name: string
  countryId: number
  stateId: number
}

// Idempotent: nama sama (case-insensitive) + country/state sama → existing (bukan 409).
export function createCity(payload: CreateCityInput): Promise<CityOption> {
  return request<CityOption>('/cities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
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

export async function listCitiesByCountry({
  countryId,
  stateId,
}: {
  countryId: number
  stateId?: number
}): Promise<CityOption[]> {
  const items: CityOption[] = []
  let page = 1
  for (;;) {
    const params = new URLSearchParams({
      'filter[countryId]': String(countryId),
      page: String(page),
      limit: String(GEO_PAGE_LIMIT),
      sortBy: 'name',
      sortOrder: 'asc',
    })
    if (stateId !== undefined) params.set('filter[stateId]', String(stateId))
    const res = await requestList<CityOption>(`/cities?${params.toString()}`)
    items.push(...res.items)
    if (res.items.length < GEO_PAGE_LIMIT || items.length >= res.total) break
    page += 1
  }
  return items
}
