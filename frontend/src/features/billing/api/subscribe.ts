import { request } from '@/lib/api-client'

import type { Billing, SubscribeInput } from '../types'

/** Buat langganan baru atau upgrade paket; billing aktif lama dibatalkan otomatis backend. */
export function subscribeBilling(payload: SubscribeInput): Promise<Billing> {
  return request<Billing>('/billings/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
