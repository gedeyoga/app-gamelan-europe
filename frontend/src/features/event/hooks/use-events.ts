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
  /** Filter generik `filter[<key>]=<value>` (diteruskan ke `GET /events`). */
  filter?: Record<string, string>
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
  filter,
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
        filter,
      },
    ],
    queryFn: () =>
      listEvents({ page, limit, search, sortBy, sortOrder, eventMonth, mine, upcoming, filter }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
