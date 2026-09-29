import { request } from '@/lib/api-client'
import type { SessionUser } from '@/features/auth/types'

// multipart field `file` — jangan set Content-Type manual, browser mengisi boundary.
// Server mengikat ke user login (tanpa entityType) dan mengembalikan profil lengkap.
export function uploadImage(file: File): Promise<SessionUser> {
  const body = new FormData()
  body.append('file', file)
  return request<SessionUser>('/auth/me/avatar', { method: 'POST', body })
}
