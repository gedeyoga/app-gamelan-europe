import { request, requestList, type ListResult } from '@/lib/api-client'

import type {
  AuthResponse,
  Country,
  LoginRequest,
  RefreshResponse,
  RegisterRequest,
  SessionUser,
  User,
} from '../types'

export function login(payload: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function register(payload: RegisterRequest): Promise<User> {
  return request<User>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

const COUNTRY_PAGE_LIMIT = 100

// Endpoint publik; countryId register opsional sehingga kegagalan load tidak memblokir submit.
// Backend cap limit=100 sedangkan dataset ~250 negara -> paginasi sampai habis.
export async function listCountries(): Promise<ListResult<Country>> {
  const items: Country[] = []
  let page = 1
  for (;;) {
    const res = await requestList<Country>(
      `/countries?page=${page}&limit=${COUNTRY_PAGE_LIMIT}&sortBy=name&sortOrder=asc`,
    )
    items.push(...res.items)
    if (res.items.length < COUNTRY_PAGE_LIMIT || items.length >= res.total) break
    page += 1
  }
  return { items, page: 1, limit: COUNTRY_PAGE_LIMIT, total: items.length }
}

export function me(): Promise<SessionUser> {
  return request<SessionUser>('/auth/me')
}

export function refreshToken(refreshToken: string): Promise<RefreshResponse> {
  return request<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
}

export function logoutApi(refreshToken?: string): Promise<null> {
  return request<null>('/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  })
}
