import { zodResolver } from '@hookform/resolvers/zod'
import { Check, PanelRightClose, PanelRightOpen, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { RichTextEditor } from '@/components/shared/rich-text-editor'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { cn } from '@/lib/utils'
import type { UploadedImage } from '@/types/image'

import { createNetworkSchema, type NetworkFormValues } from '../lib/schema'
import { buildNetworkPayload } from '../lib/payload'
import type { CreateNetworkInput, NetworkStatus } from '../types'
import { NetworkMetaPanel } from './network-meta-panel'

export interface NetworkFormProps {
  initialValues: NetworkFormValues
  isPending: boolean
  submissionError: Error | null
  onSubmit: (payload: CreateNetworkInput) => void
  onCancel: () => void
  onUploadImage: (file: File) => Promise<UploadedImage>
  onUploadError: (error: unknown) => void
  status?: NetworkStatus
  canApprove?: boolean
  canReject?: boolean
  onApprove?: (payload: CreateNetworkInput) => void
  onReject?: () => void
}

export function NetworkForm({
  initialValues,
  isPending,
  submissionError,
  onSubmit,
  onCancel,
  onUploadImage,
  onUploadError,
  status,
  canApprove,
  canReject,
  onApprove,
  onReject,
}: NetworkFormProps) {
  const { t } = useTranslation()
  const schema = useMemo(() => createNetworkSchema(t), [t])
  const form = useForm<NetworkFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })

  const [showSettings, setShowSettings] = useState(true)

  // 422 -> tampil per-field via setError; tanpa toast, tanpa banner list.
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<NetworkFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  // Banner global hanya untuk error non-422.
  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  const cancelButton = (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onCancel}>
      <X className="size-4" data-icon="inline-start" />
      {t('common:actions.cancel')}
    </Button>
  )

  const saveButton = (
    <Button type="submit" size="sm" disabled={isPending}>
      <Save className="size-4" data-icon="inline-start" />
      {isPending ? t('common:actions.saving') : t('common:actions.save')}
    </Button>
  )

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(buildNetworkPayload(values)))}
        className="flex flex-1 flex-col gap-4 lg:min-h-0"
      >
        {globalMessage && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {globalMessage}
          </p>
        )}

        {(status === 'REQUEST' || (status === 'DRAFT' && canApprove)) && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border bg-card px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {status === 'REQUEST' ? t('network:workflow.requested') : t('network:workflow.draft')}
            </span>
            {(canApprove || (status === 'REQUEST' && canReject)) && (
              <div className="flex items-center gap-2">
                {status === 'REQUEST' && canReject && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={onReject}
                  >
                    <X className="size-4" data-icon="inline-start" />
                    {t('network:workflow.reject')}
                  </Button>
                )}
                {canApprove && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={form.handleSubmit((values) => onApprove?.(buildNetworkPayload(values)))}
                  >
                    <Check className="size-4" data-icon="inline-start" />
                    {t('network:workflow.approve')}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            'relative grid gap-0 lg:min-h-0 lg:flex-1',
            showSettings && 'lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]',
          )}
        >
          {!showSettings && (
            <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
              {saveButton}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setShowSettings(true)}
                aria-label={t('network:form.showSettings')}
                title={t('network:form.showSettings')}
              >
                <PanelRightOpen className="size-4" />
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-4 lg:min-h-0">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem className="lg:flex lg:flex-1 lg:min-h-0 lg:flex-col">
                  <RichTextEditor
                    value={field.value}
                    onChange={field.onChange}
                    onUploadImage={onUploadImage}
                    // Network tidak menyimpan relasi image; gambar cukup masuk ke `content`.
                    onImageUploaded={() => undefined}
                    onUploadError={onUploadError}
                    disabled={isPending}
                    leading={cancelButton}
                    className={cn(showSettings && 'border-b-0 lg:border-b lg:border-r-0')}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {showSettings && (
            <aside className="lg:flex lg:min-h-0">
              <div className="flex w-full flex-col border bg-card lg:h-full lg:min-h-0 lg:flex-1">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-1.5">
                  <h2 className="text-sm font-semibold">{t('network:form.settingsTitle')}</h2>
                  <div className="flex items-center gap-2">
                    {saveButton}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setShowSettings(false)}
                      aria-label={t('network:form.hideSettings')}
                      title={t('network:form.hideSettings')}
                    >
                      <PanelRightClose className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                  <NetworkMetaPanel form={form} disabled={isPending} />
                </div>
              </div>
            </aside>
          )}
        </div>
      </form>
    </Form>
  )
}
