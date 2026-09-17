import { request } from '@/lib/api-client'
import type { SessionUser } from '@/features/auth/types'

import type { ChangePasswordInput, UpdateProfileInput } from '../types'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128

/**
 * `POST /api/v1/auth/change-password` — backend expects `{ currentPassword, newPassword }`.
 * `ChangePasswordInput` FE carries `confirmPassword` untuk client validation only — drop di sini.
 */
export async function changePassword(payload: ChangePasswordInput): Promise<void> {
  await request<null>('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    }),
  })
}

/**
 * `PATCH /api/v1/auth/me` — update `fullName` and/or `email` untuk authenticated user.
 * Returns updated session payload (same shape as `GET /auth/me`).
 */
export async function updateProfile(payload: UpdateProfileInput): Promise<SessionUser> {
  return request<SessionUser>('/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

// Export untuk component-level validation mirrors.
export { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH }