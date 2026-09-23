import type { TFunction } from 'i18next'
import { z } from 'zod'

import { ARCHIVE_STATUSES, ARCHIVE_TYPES } from '../types'

function isUrl(value: string): boolean {
  return z.url().safeParse(value).success
}

export function createArchiveSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('validation:archiveNameRequired'))
      .max(200, t('validation:archiveNameMax', { count: 200 })),
    description: z.string(),
    thumbnail: z.string(),
    type: z.enum(ARCHIVE_TYPES, { message: t('validation:archiveTypeInvalid') }),
    status: z.enum(ARCHIVE_STATUSES, { message: t('validation:archiveStatusInvalid') }),
    publishedAt: z.string(),
    categoryIds: z.array(z.string()),
    externalLinks: z.array(
      z
        .string()
        .trim()
        .refine((value) => value === '' || isUrl(value), {
          message: t('validation:archiveUrlInvalid'),
        }),
    ),
  })
}

export type ArchiveFormValues = z.infer<ReturnType<typeof createArchiveSchema>>
