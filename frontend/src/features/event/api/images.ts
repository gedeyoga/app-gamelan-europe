import { request } from '@/lib/api-client'

import type { UploadedImage } from '@/types/image'

// multipart field `file` + `entityType` — jangan set Content-Type manual, browser mengisi boundary.
export function uploadImage(file: File): Promise<UploadedImage> {
  const body = new FormData()
  body.append('file', file)
  body.append('entityType', 'event')
  return request<UploadedImage>('/images', { method: 'POST', body })
}
