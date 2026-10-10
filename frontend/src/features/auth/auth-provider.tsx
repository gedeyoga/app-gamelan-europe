import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { clearRefreshMarker, clearSessionStorage, isTokenExpired, ApiError } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'

import { me as fetchSession, refreshToken as refreshTokenApi } from './api/authApi'
import type { AuthResponse, RefreshResponse, SessionRole, SessionUser } from './types'

const TOKEN_KEY = 'auth.token'
const REFRESH_TOKEN_KEY = 'auth.refreshToken'
const USER_KEY = 'auth.user'
const REFRESHED_AT_KEY = 'auth.refreshedAt'

// Module-scoped in-flight memo untuk `GET /auth/me` saat `initialize()`.
// React state dibaca async; closure effect di StrictMode lihat state stale,
// jadi kita pakai module-level singleton agar deduplikasi sync lintas remount.
// ponytail: naik ke Map per-key saat ada endpoint lain yang butuh dedup.
const inFlightMe: { promise: Promise<SessionUser> | null } = { promise: null }

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  user: SessionUser | null
  status: AuthStatus
  isAuthenticated: boolean
  /** Mirror `user?.isMember` (single sumber: `SessionUser.isMember`). */
  isMember: boolean
  login: (auth: AuthResponse) => void
  logout: () => void
  /**
   * Ambil ulang `GET /auth/me` memakai token terbaru di localStorage,
   * simpan ke `localStorage['auth.user']` + state.
   * Dipakai `useLogin` setelah `storeAuth` agar permission terhidrasi
   * sebelum `navigate('/')` (backend `/auth/login` tidak mengembalikan permissions).
   */
  hydrateSession: () => Promise<SessionUser>
  /**
   * Timpa state + `localStorage['auth.user']` dengan payload sesi dari
   * mutation (`PATCH /auth/me`, `POST /auth/me/avatar`) — jaga sidebar/UI
   * tetap sinkron tanpa reload dan tanpa refetch.
   */
  setSession: (session: SessionUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isValidStoredRole(value: unknown): value is SessionRole | null {
  if (value === null || value === undefined) return true
  if (typeof value !== 'object') return false
  const role = value as Record<string, unknown>
  return typeof role.id === 'string' && typeof role.name === 'string'
}

function readStoredUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SessionUser>
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.fullName !== 'string' ||
      typeof parsed.status !== 'string'
    ) {
      localStorage.removeItem(USER_KEY)
      return null
    }
    // Cegah injeksi via devtools: permissions wajib array string,
    // role wajib null atau { id: string, name: string }.
    if (
      !Array.isArray(parsed.permissions) ||
      !parsed.permissions.every((code): code is string => typeof code === 'string')
    ) {
      localStorage.removeItem(USER_KEY)
      return null
    }
    if (!isValidStoredRole(parsed.role)) {
      localStorage.removeItem(USER_KEY)
      return null
    }
    return {
      id: parsed.id,
      email: parsed.email,
      fullName: parsed.fullName,
      status: parsed.status,
      role: parsed.role ?? null,
      permissions: parsed.permissions,
      isMember: typeof parsed.isMember === 'boolean' ? parsed.isMember : false,
      avatar: typeof parsed.avatar === 'string' ? parsed.avatar : null,
    }
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

function persistSession(session: SessionUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(session))
}

type SilentRefreshOutcome = 'success' | 'invalid' | 'error'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(readStoredUser)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const login = useCallback((auth: AuthResponse) => {
    const sessionUser: SessionUser = {
      id: auth.user.id,
      email: auth.user.email,
      fullName: auth.user.fullName,
      status: auth.user.status ?? 'ACTIVE',
      role: null,
      permissions: [],
      isMember: auth.user.isMember ?? false,
    }
    localStorage.setItem(TOKEN_KEY, auth.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken)
    persistSession(sessionUser)
    clearRefreshMarker()
    setUser(sessionUser)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(() => {
    clearSessionStorage()
    setUser(null)
    setStatus('unauthenticated')
    queryClient.clear()
  }, [])

  /**
   * Hidrasi sesi penuh via `GET /auth/me` (shared `authApi.me`).
   * Token dibaca dari localStorage oleh `lib/api-client`, jadi panggil
   * setelah `login()` menyimpan token baru. Menimpa placeholder
   * `role: null, permissions: []` dengan data backend sebelum navigate.
   */
  const setSession = useCallback((session: SessionUser): void => {
    persistSession(session)
    setUser(session)
    setStatus('authenticated')
  }, [])

  const hydrateSession = useCallback(async (): Promise<SessionUser> => {
    const session = await fetchSession()
    setSession(session)
    return session
  }, [setSession])

  useEffect(() => {
    let cancelled = false

    async function attemptSilentRefresh(): Promise<SilentRefreshOutcome> {
      const requestTs = Date.now()

      const attempt = async (): Promise<SilentRefreshOutcome> => {
        const last = Number(localStorage.getItem(REFRESHED_AT_KEY) ?? 0)
        if (last > requestTs) return 'success'

        const currentRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
        if (!currentRefresh) return 'invalid'

        // Shared helper `authApi.refreshToken` (via `lib/api-client`)
        // agar tidak ada duplikasi fetch refresh manual.
        try {
          const data: RefreshResponse = await refreshTokenApi(currentRefresh)
          localStorage.setItem(TOKEN_KEY, data.accessToken)
          localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
          localStorage.setItem(REFRESHED_AT_KEY, String(Date.now()))
          return 'success'
        } catch (error) {
          if (error instanceof ApiError) {
            return error.statusCode === 401 ? 'invalid' : 'error'
          }
          return 'error'
        }
      }

      try {
        const locks = navigator.locks as LockManager | undefined
        return locks
          ? await locks.request('auth:refresh', { mode: 'exclusive' }, attempt)
          : await attempt()
      } catch {
        return 'error'
      }
    }

    async function initialize(): Promise<void> {
      // Cache reuse: if state already reflects an authenticated session (e.g. another
      // effect/path populated it before our first run), skip the redundant `/auth/me`.
      if (status === 'authenticated' && user !== null) {
        return
      }

      const initialToken = localStorage.getItem(TOKEN_KEY)
      if (!initialToken) {
        if (!cancelled) {
          setUser(null)
          setStatus('unauthenticated')
        }
        return
      }

      if (isTokenExpired(initialToken)) {
        const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
        if (!storedRefresh) {
          clearSessionStorage()
          if (!cancelled) {
            setUser(null)
            setStatus('unauthenticated')
          }
          return
        }

        const outcome = await attemptSilentRefresh()
        if (cancelled) return

        if (outcome === 'invalid') {
          clearSessionStorage()
          setUser(null)
          setStatus('unauthenticated')
          return
        }
        if (outcome === 'error') {
          setUser(null)
          setStatus('unauthenticated')
          return
        }
      }

      // Shared helper `authApi.me` (via `lib/api-client`): unwrap envelope,
      // attach Bearer terbaru, dan auto-refresh 401 dengan lock `auth:refresh`.
      try {
        if (!inFlightMe.promise) {
          inFlightMe.promise = fetchSession()
        }
        const session = await inFlightMe.promise
        inFlightMe.promise = null
        if (cancelled) return
        setSession(session)
      } catch (error) {
        inFlightMe.promise = null
        if (cancelled) return
        if (error instanceof ApiError && error.statusCode === 401) {
          clearSessionStorage()
        }
        setUser(null)
        setStatus('unauthenticated')
      }
    }

    void initialize()

    return () => {
      cancelled = true
    }
  }, [setSession])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== TOKEN_KEY &&
        event.key !== REFRESH_TOKEN_KEY &&
        event.key !== USER_KEY &&
        event.key !== REFRESHED_AT_KEY
      ) {
        return
      }
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) {
        setUser(null)
        setStatus('unauthenticated')
        return
      }
      const stored = readStoredUser()
      setUser(stored)
      setStatus('authenticated')
    }

    const handleExpired = () => {
      setUser(null)
      setStatus('unauthenticated')
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('auth:expired', handleExpired)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('auth:expired', handleExpired)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isMember: user?.isMember ?? false,
      login,
      logout,
      hydrateSession,
      setSession,
    }),
    [user, status, login, logout, hydrateSession, setSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
