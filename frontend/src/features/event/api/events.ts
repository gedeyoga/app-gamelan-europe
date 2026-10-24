import { request, requestList, type ListResult } from '@/lib/api-client'
import { appendListParams, type ListParams } from '@/lib/list-params'

import type { ContentStatus, CreateEventInput, Event, UpdateEventInput } from '../types'

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

/** Batas keras ID yang dikumpulkan (select-all lintas halaman). */
export const MAX_BULK_IDS = 2000
/** Batas `limit` list backend. */
const IDS_PAGE_LIMIT = 100

/**
 * Kumpulkan ID semua event yang cocok dengan `search`/`eventTypeId`/`filter`
 * (lintas halaman), untuk select-all. Loop `limit: 100` sampai `total` atau cap 2000.
 */
export async function listAllEventIds({
  search,
  eventTypeId,
  filter,
}: Omit<
  ListEventsParams,
  'page' | 'limit' | 'mine' | 'upcoming' | 'eventMonth'
>): Promise<string[]> {
  const ids: string[] = []
  for (let page = 1; page <= Math.ceil(MAX_BULK_IDS / IDS_PAGE_LIMIT); page += 1) {
    const result = await listEvents({ page, limit: IDS_PAGE_LIMIT, search, eventTypeId, filter })
    ids.push(...result.items.map((item) => item.id))
    if (ids.length >= result.total || result.items.length === 0) break
  }
  return ids.slice(0, MAX_BULK_IDS)
}

export function bulkUpdateEventStatus({
  ids,
  status,
}: {
  ids: string[]
  status: ContentStatus
}): Promise<{ updated: number; skipped: number; failed: number }> {
  return request<{ updated: number; skipped: number; failed: number }>('/events/bulk-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  })
}

export function bulkDeleteEvents({
  ids,
}: {
  ids: string[]
}): Promise<{ deleted: number; failed: number }> {
  return request<{ deleted: number; failed: number }>('/events/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
}

export function getEvent(id: string): Promise<Event> {
  return request<Event>(`/events/${id}`)
}

export function getEventBySlug(slug: string): Promise<Event> {
  return request<Event>(`/events/slug/${encodeURIComponent(slug)}`)
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

export function approveEvent(
  id: string,
  publishedAt?: string,
  notify?: boolean,
): Promise<Event> {
  const body = {
    ...(publishedAt === undefined ? {} : { publishedAt }),
    ...(notify === undefined ? {} : { notify }),
  }
  if (Object.keys(body).length === 0) {
    return request<Event>(`/events/${id}/approve`, { method: 'POST' })
  }
  return request<Event>(`/events/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function rejectEvent(id: string): Promise<Event> {
  return request<Event>(`/events/${id}/reject`, { method: 'POST' })
}
