import { request } from '@/lib/api-client'

import type { UploadedImage } from '../types'

// multipart field `file` — jangan set Content-Type manual, browser mengisi boundary.
// Khusus thumbnail image (`POST /images`, entityType default 'post'); tidak diubah.
export function uploadImage(file: File): Promise<UploadedImage> {
  const body = new FormData()
  body.append('file', file)
  return request<UploadedImage>('/images', { method: 'POST', body })
}
