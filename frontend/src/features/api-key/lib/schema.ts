import type { TFunction } from 'i18next'
import { z } from 'zod'

// Schema form API key — pesan validasi hanya dari `t('validation:*')`.
// `name` wajib (trim, max 100) & `permissionCodes` minimal 1 (mirror DTO backend).
export function createApiKeyFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('validation:nameRequired'))
      .max(100, t('validation:nameMax', { count: 100 })),
    permissionCodes: z.array(z.string()).min(1, t('validation:permissionRequired')),
  })
}

export type ApiKeyFormValues = z.infer<ReturnType<typeof createApiKeyFormSchema>>
