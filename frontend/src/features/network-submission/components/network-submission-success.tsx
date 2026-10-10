import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'

export function NetworkSubmissionSuccess() {
  const { t } = useTranslation()
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t('networkSubmission:success.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('networkSubmission:success.message')}
        </p>
      </CardContent>
    </Card>
  )
}
