import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { CreateEventInput, Event, UpdateEventInput } from '../types'

export type ListEventsParams = ListParams

export function listEvents(params: ListEventsParams): Promise<ListResult<Event>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  return requestList<Event>(`/events?${search.toString()}`)
}

export function getEvent(id: string): Promise<Event> {
  return request<Event>(`/events/${id}`)
}

export function createEvent(payload: CreateEventInput): Promise<Event> {
  return request<Event>('/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateEvent(id: string, payload: UpdateEventInput): Promise<Event> {
  return request<Event>(`/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteEvent(id: string): Promise<Event> {
  return request<Event>(`/events/${id}`, { method: 'DELETE' })
}
