import { ApiError } from '@/lib/api-client'

import type { SessionUser } from '../types'

export type MaybeSessionUser = SessionUser | null | undefined

/**
 * Ambil daftar kode permission milik user secara aman.
 * Menangani `null` (tanpa role) dan bentuk tak terduga dari storage.
 */
export function getPermissions(user: MaybeSessionUser): string[] {
  if (!user) return []
  if (!Array.isArray(user.permissions)) return []
  return user.permissions.filter((code): code is string => typeof code === 'string')
}

/**
 * Cek satu permission dengan format `resource:action` (mis. `user:read`).
 */
export function hasPermission(user: MaybeSessionUser, code: string): boolean {
  if (!code) return false
  return getPermissions(user).includes(code)
}

/**
 * Cek apakah user punya minimal satu dari daftar kode.
 * Deny-by-default: array kosong → `false` (tidak membuka gate bila salah pakai).
 */
export function hasAnyPermission(user: MaybeSessionUser, codes: string[]): boolean {
  if (!Array.isArray(codes) || codes.length === 0) return false
  const owned = getPermissions(user)
  return codes.some((code) => owned.includes(code))
}

/**
 * Type guard untuk error 403 dari backend.
 * Dipakai di query/mutation untuk menampilkan empty-state "Tidak punya akses",
 * dibedakan dari 401 (redirect login sudah ditangani `lib/api-client.ts`).
 */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 403
}
