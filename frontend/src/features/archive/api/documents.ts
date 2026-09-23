import { request } from '@/lib/api-client'

import type { ArchiveDocument } from '../types'

// multipart field `file` — jangan set Content-Type manual, browser mengisi boundary.
// Endpoint terpisah untuk dokumen PDF (`application/pdf`, max 10 MB).
export function uploadDocument(file: File): Promise<ArchiveDocument> {
  const body = new FormData()
  body.append('file', file)
  return request<ArchiveDocument>('/documents', { method: 'POST', body })
}
