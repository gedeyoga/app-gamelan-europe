declare global {
  interface Window {
    __API_BASE_URL__?: string
  }
}

const BASE_URL =
  window.__API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL || '/api/v1'
const TOKEN_KEY = 'auth.token'
const REFRESH_TOKEN_KEY = 'auth.refreshToken'
const USER_KEY = 'auth.user'
const REFRESHED_AT_KEY = 'auth.refreshedAt'

interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

interface ApiErrorBody {
  statusCode?: number
  message?: string
  errors?: unknown
}

type RefreshOutcome = 'success' | 'invalid' | 'error'

let refreshPromise: Promise<RefreshOutcome> | null = null

async function doRefresh(): Promise<RefreshOutcome> {
  const requestTs = Date.now()

  const attempt = async (): Promise<RefreshOutcome> => {
    const last = Number(localStorage.getItem(REFRESHED_AT_KEY) ?? 0)
    if (last > requestTs) return 'success'

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) return 'invalid'

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (res.ok) {
        const body = (await res.json()) as { data: RefreshResponse }
        localStorage.setItem(TOKEN_KEY, body.data.accessToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, body.data.refreshToken)
        localStorage.setItem(REFRESHED_AT_KEY, String(Date.now()))
        return 'success'
      }
      return res.status === 401 ? 'invalid' : 'error'
    } catch {
      return 'error'
    }
  }

  const locks = navigator.locks as LockManager | undefined
  return locks ? locks.request('auth:refresh', { mode: 'exclusive' }, attempt) : attempt()
}

async function refreshTokens(): Promise<RefreshOutcome> {
  if (refreshPromise) return refreshPromise

  refreshPromise = doRefresh()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

function expireSession(): void {
  clearSessionStorage()
  window.location.assign('/login')
}

export interface ListResult<T> {
  items: T[]
  page: number
  limit: number
  total: number
}

export function isTokenExpired(token: string, skewSec = 60): boolean {
  try {
    const parts = token.split('.')
    if (parts.length < 2 || !parts[1]) return true
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = atob(padded)
    const payload = JSON.parse(json) as { exp?: unknown }
    if (typeof payload.exp !== 'number') return true
    const nowSec = Math.floor(Date.now() / 1000)
    return payload.exp <= nowSec + skewSec
  } catch {
    return true
  }
}

export function clearSessionStorage(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(REFRESHED_AT_KEY)
  window.dispatchEvent(new Event('auth:expired'))
}

export function clearRefreshMarker(): void {
  localStorage.removeItem(REFRESHED_AT_KEY)
}

export class ApiError extends Error {
  readonly statusCode?: number
  readonly errors?: unknown

  constructor(body: ApiErrorBody, status?: number) {
    super(body.message ?? 'Request failed')
    this.name = 'ApiError'
    this.statusCode = body.statusCode ?? status
    this.errors = body.errors
  }
}

/**
 * True bila error adalah error validasi (ApiError statusCode 422).
 * Dipakai untuk skip toast/banner list dan menampilkan error per-field
 * via `form.setError` + `<FormMessage />`.
 */
export function isValidationError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.statusCode === 422
}

/**
 * True bila error adalah konflik (ApiError statusCode 409), mis. slug duplikat.
 * Dipakai untuk menampilkan error per-field tanpa toast/banner generik.
 */
export function isConflictError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.statusCode === 409
}

/**
 * True bila error adalah not-found (ApiError statusCode 404).
 * Dipakai halaman detail untuk membedakan "data tidak ada" dari error generik.
 */
export function isNotFoundError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.statusCode === 404
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function buildHeaders(init?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {}
  const original = init?.headers
  if (original) {
    if (original instanceof Headers) {
      original.forEach((value, key) => {
        if (key.toLowerCase() !== 'authorization') headers[key] = value
      })
    } else if (Array.isArray(original)) {
      for (const [key, value] of original) {
        if (key.toLowerCase() !== 'authorization') headers[key] = value
      }
    } else {
      for (const [key, value] of Object.entries(original)) {
        if (key.toLowerCase() !== 'authorization') headers[key] = value
      }
    }
  }
  return { ...headers, ...authHeaders() }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody = {}
  try {
    body = (await res.json()) as ApiErrorBody
  } catch {
    // non-JSON error response; fall back to status text
  }
  return new ApiError(body, res.status)
}

async function doFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init),
  })

  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    const outcome = await refreshTokens()
    if (outcome === 'success') {
      res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: buildHeaders(init),
      })
    } else if (outcome === 'invalid') {
      const error = await parseError(res)
      expireSession()
      throw error
    } else {
      throw await parseError(res)
    }
  }

  if (!res.ok) throw await parseError(res)

  return (await res.json()) as T
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await doFetch<{ data: T }>(path, init)
  return data
}

export async function requestList<T>(
  path: string,
  init?: RequestInit,
): Promise<ListResult<T>> {
  const b = await doFetch<{ data: T[]; meta: { page: number; limit: number; total: number } }>(
    path,
    init,
  )
  return { items: b.data, page: b.meta.page, limit: b.meta.limit, total: b.meta.total }
}