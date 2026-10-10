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

// Sumber tunggal scope konten — MIRROR backend `access-scope.service.ts` (canViewPrivateFromCodes).
export const CONTENT_RESOURCES = ['story', 'event', 'archive'] as const
// Action tulis konten (create/update/submit) → penanda "pengelola konten".
export const CONTENT_WRITE_ACTIONS = ['create', 'update', 'submit'] as const
// Action status-manager/moderator konten (approve/publish/reject/unpublish) → scope `all`.
export const CONTENT_MODERATOR_ACTIONS = ['approve', 'publish', 'reject', 'unpublish'] as const

function hasActions(codes: string[], resource: string, actions: readonly string[]): boolean {
  return actions.some((action) => codes.includes(`${resource}:${action}`))
}

/**
 * `canViewPrivate` backend: HANYA content manager/status-manager (punya permission tulis ATAU
 * status konten) — BUKAN sekadar `*:read`. Harus sama persis dengan `canViewPrivateFromCodes`
 * backend; dipakai untuk mengizinkan user ber-privilege melihat konten PRIVATE/MEMBER.
 */
export function canViewPrivate(codes: string[]): boolean {
  if (!Array.isArray(codes) || codes.length === 0) return false
  return CONTENT_RESOURCES.some(
    (resource) =>
      hasActions(codes, resource, CONTENT_WRITE_ACTIONS) ||
      hasActions(codes, resource, CONTENT_MODERATOR_ACTIONS),
  )
}

/**
 * Type guard untuk error 403 dari backend.
 * Dipakai di query/mutation untuk menampilkan empty-state "Tidak punya akses",
 * dibedakan dari 401 (redirect login sudah ditangani `lib/api-client.ts`).
 */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 403
}
