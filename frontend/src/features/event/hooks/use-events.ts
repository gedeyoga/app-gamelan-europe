import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { ListSortOrder } from '@/lib/list-params'

import { listEvents } from '../api/events'

export interface UseEventsParams {
  page: number
  limit: number
  search?: string
  sortBy?: string | null
  sortOrder?: ListSortOrder | null
  /** Filter `YYYY-MM` (diteruskan ke `GET /events`). */
  eventMonth?: string
  /** `true` → hanya event seorganisasi/milik user (diteruskan ke `GET /events`). */
  mine?: boolean
  /** `true` → hanya event dengan tanggal ≥ sekarang (diteruskan ke `GET /events`). */
  upcoming?: boolean
  /** Filter tipe event (UUID) — diteruskan ke `GET /events`. */
  eventTypeId?: string
  /** Filter generik `filter[<key>]=<value>` (diteruskan ke `GET /events`). */
  filter?: Record<string, string>
  /** `false` → query tidak dijalankan (mis. gate admin di dashboard). */
  enabled?: boolean
}

export function useEvents({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
  eventMonth,
  mine,
  upcoming,
  eventTypeId,
  filter,
  enabled,
}: UseEventsParams) {
  return useQuery({
    queryKey: [
      'event',
      {
        page,
        limit,
        search: (search ?? '').trim(),
        sortBy,
        sortOrder,
        eventMonth,
        mine,
        upcoming,
        eventTypeId,
        filter,
      },
    ],
    queryFn: () =>
      listEvents({
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        eventMonth,
        mine,
        upcoming,
        eventTypeId,
        filter,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}
