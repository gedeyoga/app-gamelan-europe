import type { TFunction } from 'i18next'
import { z } from 'zod'

import type { NetworkOrganisationType } from '../types'
import {
  ACTIVITY_TYPE_OPTIONS,
  ACTIVITY_TYPE_OTHER,
  ORGANISATION_TYPES,
} from '@/features/network/lib/constants'

// Konstanta dimiliki fitur `network` (arah dependensi: submission → network); re-export demi importer lama.
export { ACTIVITY_TYPE_OPTIONS, ACTIVITY_TYPE_OTHER, ORGANISATION_TYPES }

function isUrl(value: string): boolean {
  return z.url().safeParse(value).success
}

export function createNetworkSubmissionSchema(t: TFunction) {
  return z
    .object({
      organisationType: z
        .string()
        .refine((value) => value.trim().length > 0, t('validation:organisationTypeRequired'))
        .refine(
          (value) =>
            value === '' ||
            ORGANISATION_TYPES.includes(value as NetworkOrganisationType),
          t('validation:organisationTypeInvalid'),
        ),
      name: z
        .string()
        .trim()
        .min(1, t('validation:nameRequired'))
        .max(200, t('validation:nameMax', { count: 200 })),
      ledBy: z.string().trim().max(200, t('validation:ledByMax', { count: 200 })),
      // Geo disimpan sebagai string id numerik; dikonversi Number saat submit.
      countryId: z.string().min(1, t('validation:countryRequired')),
      stateId: z.string(),
      address: z.string().trim().max(500, t('validation:addressMax', { count: 500 })),
      mapsUrl: z
        .string()
        .trim()
        .max(2048, t('validation:mapsUrlMax', { count: 2048 }))
        .refine((value) => value === '' || isUrl(value), t('validation:mapsUrlInvalid')),
      website: z
        .string()
        .trim()
        .max(500, t('validation:websiteMax', { count: 500 }))
        .refine((value) => value === '' || isUrl(value), t('validation:websiteInvalid')),
      contact: z
        .string()
        .trim()
        .min(1, t('validation:emailRequired'))
        .max(200, t('validation:emailMax', { count: 200 }))
        .email(t('validation:emailInvalid')),
      socialMedia: z
        .array(
          z.object({
            platform: z
              .string()
              .trim()
              .max(50, t('validation:socialPlatformMax', { count: 50 })),
            url: z
              .string()
              .trim()
              .max(500, t('validation:socialUrlMax', { count: 500 }))
              .refine((value) => value === '' || isUrl(value), t('validation:socialUrlInvalid')),
          }),
        )
        .max(10, t('validation:socialMediaMax', { count: 10 }))
        // Baris kosong di-strip saat submit; baris terisi wajib lengkap.
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
      content: z
        .string()
        .trim()
        .min(1, t('validation:contentRequired'))
        .max(10000, t('validation:contentMax', { count: 10000 })),
      submitter: z.object({
        fullName: z
          .string()
          .trim()
          .min(1, t('validation:fullNameRequired'))
          .max(200, t('validation:fullNameMax', { count: 200 })),
        email: z
          .string()
          .trim()
          .min(1, t('validation:emailRequired'))
          .max(200, t('validation:emailMax', { count: 200 }))
          .email(t('validation:emailInvalid')),
        countryId: z.string().min(1, t('validation:submitterCountryRequired')),
        stateId: z.string(),
      }),
    })
    .superRefine((values, ctx) => {
      if (
        values.activityType === ACTIVITY_TYPE_OTHER &&
        values.activityTypeOther.trim().length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['activityTypeOther'],
          message: t('validation:activityTypeOtherRequired'),
        })
      }
    })
}

export type NetworkSubmissionFormValues = z.infer<
  ReturnType<typeof createNetworkSubmissionSchema>
>

export const EMPTY_NETWORK_SUBMISSION_VALUES: NetworkSubmissionFormValues = {
  organisationType: '',
  name: '',
  ledBy: '',
  countryId: '',
  stateId: '',
  address: '',
  mapsUrl: '',
  website: '',
  contact: '',
  socialMedia: [],
  activityType: '',
  activityTypeOther: '',
  content: '',
  submitter: {
    fullName: '',
    email: '',
    countryId: '',
    stateId: '',
  },
}
