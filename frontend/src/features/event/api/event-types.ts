import { request, requestList, type ListResult } from '@/lib/api-client'

import type { EventType } from '../types'

export function listEventTypes(): Promise<ListResult<EventType>> {
  return requestList<EventType>('/event-types?limit=100')
}

export interface CreateEventTypeInput {
  name: string
}

// Idempotent: nama sama mengembalikan existing (bukan 409).
export function createEventType(payload: CreateEventTypeInput): Promise<EventType> {
  return request<EventType>('/event-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteEventType(id: string): Promise<EventType> {
  return request<EventType>(`/event-types/${id}`, { method: 'DELETE' })
}
