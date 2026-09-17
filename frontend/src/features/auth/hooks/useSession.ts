import { useQuery } from '@tanstack/react-query'

import { ApiError } from '@/lib/api-client'

import { me } from '../api/authApi'
import type { SessionUser } from '../types'

const STALE_TIME_MS = 60 * 1000
const AUTH_TOKEN_KEY = 'auth.token'

/**
 * Hook sesi aktif — `GET /auth/me` dengan TanStack Query.
 *
 * - Query key `['auth', 'me']` dibagikan dengan in-flight fetch di `AuthProvider`,
 *   sehingga double-fetch di-mount pertama di-dedup otomatis oleh QueryClient.
 * - `placeholderData` opsional: pass `useAuth().user` dari container agar render
 *   pertama tidak kosong saat hydrate dari `localStorage['auth.user']`.
 * - `retry` anti-double-refresh: 401 sudah ditangani `lib/api-client.ts` (redirect
 *   login via `expireSession`); query cukup return error tanpa retry agar tidak
 *   memicu refresh berulang.
 * - Hanya fetch bila ada token di localStorage (status `loading`/`authenticated`).
 */
export function useSession(placeholder?: SessionUser) {
  return useQuery<SessionUser>({
    queryKey: ['auth', 'me'],
    queryFn: me,
    staleTime: STALE_TIME_MS,
    retry: (failureCount, error) =>
      error instanceof ApiError && error.statusCode === 401 ? false : failureCount < 1,
    enabled: typeof window !== 'undefined' && Boolean(localStorage.getItem(AUTH_TOKEN_KEY)),
    ...(placeholder ? { placeholderData: placeholder } : {}),
  })
}