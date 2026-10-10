import { request } from '@/lib/api-client'

import type { Billing } from '../types'

/** Batalkan billing aktif milik member. */
export function cancelBilling(id: string): Promise<Billing> {
  return request<Billing>(`/billings/${id}/cancel`, { method: 'POST' })
}
