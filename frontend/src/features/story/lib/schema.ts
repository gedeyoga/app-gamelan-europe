import type { TFunction } from 'i18next'
import { z } from 'zod'

import { CONTENT_STATUSES, VISIBILITIES } from '../types'

export function createStorySchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('validation:storyNameRequired'))
      .max(200, t('validation:storyNameMax', { count: 200 })),
    slug: z
      .string()
      .trim()
      .max(200, t('validation:storySlugMax', { count: 200 }))
      .refine((value) => value === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
        message: t('validation:storySlugPattern'),
      }),
    content: z.string(),
    thumbnail: z.string().nullable(),
    status: z.enum(CONTENT_STATUSES),
    visibility: z.enum(VISIBILITIES),
    categoryIds: z.array(z.string()),
    authorIds: z.array(z.string().uuid()),
    imageIds: z.array(z.string()),
  })
}

export type StoryFormValues = z.infer<ReturnType<typeof createStorySchema>>
