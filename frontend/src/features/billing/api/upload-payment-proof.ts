import { request } from '@/lib/api-client'

import type { PaymentProof } from '../types'

// multipart field `file` — jangan set Content-Type manual, browser mengisi boundary.
// Terima gambar (jpeg/png/webp) atau PDF, maks 10 MB (divalidasi client + backend).
export function uploadPaymentProof(file: File): Promise<PaymentProof> {
  const body = new FormData()
  body.append('file', file)
  return request<PaymentProof>('/billings/payment-proof', { method: 'POST', body })
}
