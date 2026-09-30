import type { TFunction } from 'i18next'
import { z } from 'zod'

// Angka opsional disimpan sebagai string di form; divalidasi rentang saat submit.
function emptyOrInRange(min: number, max: number) {
  return (value: string) => {
    if (value.trim() === '') return true
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= min && parsed <= max
  }
}

export function createNetworkSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('validation:nameRequired'))
      .max(200, t('validation:nameMax', { count: 200 })),
    state: z.string().trim().max(100, t('validation:nameMax', { count: 100 })),
    country: z.string().trim().max(100, t('validation:nameMax', { count: 100 })),
    address: z.string().trim().max(500, t('validation:addressMax', { count: 500 })),
    website: z.string().trim().max(500, t('validation:websiteMax', { count: 500 })),
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
    lat: z.string().trim().refine(emptyOrInRange(-90, 90), t('validation:latInvalid')),
    lng: z.string().trim().refine(emptyOrInRange(-180, 180), t('validation:lngInvalid')),
    content: z.string().max(100000, t('validation:contentMax', { count: 100000 })),
  })
}

export type NetworkFormValues = z.infer<ReturnType<typeof createNetworkSchema>>

export const EMPTY_NETWORK_VALUES: NetworkFormValues = {
  name: '',
  state: '',
  country: '',
  address: '',
  website: '',
  contact: '',
  socialMedia: [],
  lat: '',
  lng: '',
  content: '',
}
