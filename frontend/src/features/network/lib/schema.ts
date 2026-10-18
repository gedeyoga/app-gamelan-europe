import type { TFunction } from 'i18next'
import { z } from 'zod'

import type { NetworkOrganisationType } from '../types'
import { ACTIVITY_TYPE_OTHER, ORGANISATION_TYPES } from './constants'

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function createNetworkSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('validation:nameRequired'))
      .max(200, t('validation:nameMax', { count: 200 })),
    organisationType: z
      .string()
      .refine(
        (value) => value === '' || ORGANISATION_TYPES.includes(value as NetworkOrganisationType),
        t('validation:organisationTypeInvalid'),
      ),
    ledBy: z.string().trim().max(200, t('validation:ledByMax', { count: 200 })),
    state: z.string().trim().max(100, t('validation:nameMax', { count: 100 })),
    country: z.string().trim().max(100, t('validation:nameMax', { count: 100 })),
    address: z.string().trim().max(500, t('validation:addressMax', { count: 500 })),
    website: z.string().trim().max(500, t('validation:websiteMax', { count: 500 })),
    mapsUrl: z
      .string()
      .trim()
      .max(2048, t('validation:mapsUrlMax', { count: 2048 }))
      .refine((value) => value === '' || isValidHttpUrl(value), t('validation:mapsUrlInvalid')),
    contact: z.string().trim().max(200, t('validation:contactMax', { count: 200 })),
    socialMedia: z
      .array(
        z.object({
          platform: z
            .string()
            .trim()
            .max(50, t('validation:socialPlatformMax', { count: 50 })),
          url: z.string().trim().max(500, t('validation:socialUrlMax', { count: 500 })),
        }),
      )
      .max(10, t('validation:socialMediaMax', { count: 10 }))
      // Baris kosong (platform & url kosong) di-strip saat submit; baris terisi wajib lengkap.
      .superRefine((rows, ctx) => {
        rows.forEach((row, index) => {
          const hasPlatform = row.platform.length > 0
          const hasUrl = row.url.length > 0
          if (!hasPlatform && !hasUrl) return
          if (!hasPlatform) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'platform'],
              message: t('validation:socialPlatformRequired'),
            })
          }
          if (!hasUrl) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'url'],
              message: t('validation:socialUrlRequired'),
            })
          }
        })
      }),
    activityType: z.string().trim().max(100, t('validation:activityTypeMax', { count: 100 })),
    activityTypeOther: z
      .string()
      .trim()
      .max(100, t('validation:activityTypeMax', { count: 100 })),
    content: z.string().max(100000, t('validation:contentMax', { count: 100000 })),
    submitterFullName: z.string().trim().max(200, t('validation:fullNameMax', { count: 200 })),
    submitterEmail: z
      .string()
      .trim()
      .max(200, t('validation:emailMax', { count: 200 }))
      .refine(
        (value) => value === '' || z.email().safeParse(value).success,
        t('validation:emailInvalid'),
      ),
    submitterCountry: z.string().trim().max(100, t('validation:nameMax', { count: 100 })),
    submitterState: z.string().trim().max(100, t('validation:nameMax', { count: 100 })),
  }).superRefine((values, ctx) => {
    if (values.activityType === ACTIVITY_TYPE_OTHER && values.activityTypeOther.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['activityTypeOther'],
        message: t('validation:activityTypeOtherRequired'),
      })
    }
  })
}

export type NetworkFormValues = z.infer<ReturnType<typeof createNetworkSchema>>

export const EMPTY_NETWORK_VALUES: NetworkFormValues = {
  name: '',
  organisationType: '',
  ledBy: '',
  state: '',
  country: '',
  address: '',
  website: '',
  mapsUrl: '',
  contact: '',
  socialMedia: [],
  activityType: '',
  activityTypeOther: '',
  content: '',
  submitterFullName: '',
  submitterEmail: '',
  submitterCountry: '',
  submitterState: '',
}
