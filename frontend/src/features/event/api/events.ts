import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { CreateEventInput, Event, UpdateEventInput } from '../types'

export interface ListEventsParams extends ListParams {
  /** Filter `YYYY-MM`: event dengan minimal satu tanggal di dalam bulan UTC tsb. */
  eventMonth?: string
  /** `true` → event seorganisasi (atau milik user bila tanpa organisasi). */
  mine?: boolean
  /** `true` → hanya event dengan minimal satu tanggal ≥ sekarang. */
  upcoming?: boolean
  /** Filter tipe event (UUID); param query top-level `eventTypeId`. */
  eventTypeId?: string
  /** Filter generik `filter[<key>]=<value>` (mis. `{ status: 'PUBLISHED' }`). */
  filter?: Record<string, string>
}

export function listEvents(params: ListEventsParams): Promise<ListResult<Event>> {
  const search = new URLSearchParams()
  appendListParams(search, params)
  if (params.eventMonth) search.set('eventMonth', params.eventMonth)
  if (params.mine) search.set('mine', 'true')
  if (params.upcoming) search.set('upcoming', 'true')
  if (params.eventTypeId) search.set('eventTypeId', params.eventTypeId)
  for (const [key, value] of Object.entries(params.filter ?? {})) {
    search.set(`filter[${key}]`, value)
  }
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

export function submitEvent(id: string): Promise<Event> {
  return request<Event>(`/events/${id}/submit`, { method: 'POST' })
}

export function approveEvent(id: string, publishedAt?: string): Promise<Event> {
  if (publishedAt === undefined) {
    return request<Event>(`/events/${id}/approve`, { method: 'POST' })
  }
  return request<Event>(`/events/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishedAt }),
  })
}

export function rejectEvent(id: string): Promise<Event> {
  return request<Event>(`/events/${id}/reject`, { method: 'POST' })
}
