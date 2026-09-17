import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-provider'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'

export interface RequirePermissionProps {
  /** Satu kode permission (`resource:action`), mis. `code="user:read"`. */
  code?: string
  /** Alternatif: lolos bila punya minimal satu, mis. `anyOf={['user:update', 'user:delete']}`. */
  anyOf?: string[]
  /**
   * Render pengganti saat tak punya akses.
   * Default (tanpa `fallback`) → redirect ke `/403`.
   * Untuk tombol/aksi inline, kirim `fallback={null}` agar disembunyikan.
   */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Gate permission untuk route maupun komponen.
 * Route: `<RequirePermission code="user:read"><UsersPage /></RequirePermission>` → tanpa akses ke `/403`.
 * Tombol: `<RequirePermission code="user:delete" fallback={null}><Button …/></RequirePermission>`.
 *
 * Prioritas props: `code` diutamakan bila keduanya diisi; `anyOf` dipakai
 * hanya bila `code` kosong; tanpa `code` dan tanpa `anyOf` (atau `anyOf=[]`)
 * → deny-by-default (`false` + `console.warn`) agar salah pakai tidak membuka gate.
 *
 * Pengecualian layering yang disengaja: komponen shared ini membaca sesi auth
 * karena tugasnya justru menegakkan permission lintas fitur.
 */
export function RequirePermission({ code, anyOf, fallback, children }: RequirePermissionProps) {
  const { status } = useAuth()
  const { can, canAny } = useAuthPermissions()

  // Sesi masih dimuat (`GET /auth/me`) — tahan render agar tak salah redirect ke /403.
  if (status === 'loading') return null

  let allowed: boolean
  if (code) {
    allowed = can(code)
  } else if (anyOf && anyOf.length > 0) {
    allowed = canAny(anyOf)
  } else {
    console.warn('[RequirePermission] tanpa `code`/`anyOf` → deny-by-default (false).')
    allowed = false
  }

  if (allowed) return <>{children}</>
  if (fallback !== undefined) return <>{fallback}</>
  return <Navigate to="/403" replace />
}

/** Alias ringkas untuk pemakaian inline: `<Can code="role:create" fallback={null}>…</Can>`. */
export const Can = RequirePermission
