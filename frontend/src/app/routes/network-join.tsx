import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { Badge } from '@/components/ui/badge'
import { NetworkSubmissionForm } from '@/features/network-submission/components/network-submission-form'
import { NetworkSubmissionSuccess } from '@/features/network-submission/components/network-submission-success'
import { useCreateNetworkSubmission } from '@/features/network-submission/hooks/use-create-network-submission'
import type { CreateNetworkSubmissionInput } from '@/features/network-submission/types'
import { toastSuccess } from '@/lib/toast'

export function NetworkJoinPage() {
  const { t } = useTranslation()
  const [submitted, setSubmitted] = useState(false)
  const createSubmission = useCreateNetworkSubmission()

  function handleSubmit(payload: CreateNetworkSubmissionInput) {
    createSubmission.mutate(payload, {
      onSuccess: () => {
        toastSuccess(t('networkSubmission:success.toast'))
        setSubmitted(true)
      },
    })
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="w-fit">
            {t('networkSubmission:hero.badge')}
          </Badge>
          <h1 className="font-heading text-2xl font-semibold">
            {t('networkSubmission:hero.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('networkSubmission:hero.subtitle')}
          </p>
        </div>
        <LanguageSwitcher />
      </header>

      {submitted ? (
        <NetworkSubmissionSuccess />
      ) : (
        <NetworkSubmissionForm
          isPending={createSubmission.isPending}
          submissionError={createSubmission.error}
          onSubmit={handleSubmit}
        />
      )}
    </main>
  )
}
