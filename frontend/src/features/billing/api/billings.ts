import { request, requestList } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { Billing, CreateBillingInput, UpdateBillingInput } from '../types'

export type ListBillingsParams = ListParams

export interface BillingListResult {
  items: Billing[]
  page: number
  limit: number
  total: number
}

export function listBillings(params: ListBillingsParams): Promise<BillingListResult> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  return requestList<Billing>(`/billings?${search.toString()}`)
}

export function createBilling(payload: CreateBillingInput): Promise<Billing> {
  return request<Billing>('/billings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateBilling(id: string, payload: UpdateBillingInput): Promise<Billing> {
  return request<Billing>(`/billings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteBilling(id: string): Promise<Billing> {
  return request<Billing>(`/billings/${id}`, { method: 'DELETE' })
}
