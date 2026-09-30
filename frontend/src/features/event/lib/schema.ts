import type { TFunction } from 'i18next'
import { z } from 'zod'

import { CONTENT_STATUSES, VISIBILITIES } from '../types'

export function createEventSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('validation:eventNameRequired'))
      .max(200, t('validation:eventNameMax', { count: 200 })),
    slug: z
      .string()
      .trim()
      .max(200, t('validation:eventSlugMax', { count: 200 }))
      .refine((value) => value === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
        message: t('validation:eventSlugPattern'),
      }),
    content: z.string(),
    thumbnail: z.string().nullable(),
    status: z.enum(CONTENT_STATUSES),
    visibility: z.enum(VISIBILITIES),
    eventTypeIds: z.array(z.string()),
    authorIds: z.array(z.string().uuid()),
    // '' = tanpa penyelenggara; nilai non-kosong selalu UUID dari API.
    networkId: z.string(),
    // Baris tanggal: `date` "YYYY-MM-DD", jam "HH:mm" ('' bila kosong).
    dates: z.array(
      z.object({
        date: z.string(),
        startTime: z.string(),
        endTime: z.string(),
      }),
    ),
    location: z.object({
      name: z
        .string()
        .trim()
        .min(1, t('validation:eventLocationRequired'))
        .max(200, t('validation:eventLocationMax', { count: 200 })),
      address: z
        .string()
        .trim()
        .max(500, t('validation:eventAddressMax', { count: 500 })),
      // String agar aman terhadap kolom DECIMAL backend; dikonversi ke number saat submit.
      lat: z.string(),
      lng: z.string(),
    }),
  })
}

export type EventFormValues = z.infer<ReturnType<typeof createEventSchema>>
export type EventDateFormValue = EventFormValues['dates'][number]

export const EMPTY_EVENT_VALUES: EventFormValues = {
  name: '',
  slug: '',
  content: '',
  thumbnail: null,
  status: 'DRAFT',
  visibility: 'PUBLIC',
  eventTypeIds: [],
  authorIds: [],
  networkId: '',
  dates: [],
  location: { name: '', address: '', lat: '', lng: '' },
}
