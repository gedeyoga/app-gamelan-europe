import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  Check,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Send,
  X,
} from 'lucide-react'

import { RichTextEditor } from '@/components/shared/rich-text-editor'
import { PublishScheduleDialog } from '@/components/shared/publish-schedule-dialog'
import type { SearchSelectOption } from '@/components/shared/search-select'
import type { UserOption } from '@/components/shared/user-combobox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FormField, FormItem, FormMessage, Form } from '@/components/ui/form'
import { ApiError, isConflictError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { cn } from '@/lib/utils'

import { EventMetaPanel } from './event-meta-panel'
import { createEventSchema, type EventFormValues } from '../lib/schema'
import { slugify } from '../lib/slug'
import type {
  ContentStatus,
  CreateEventInput,
  EventDateInput,
  EventFormAction,
  EventLocationInput,
  EventType,
} from '../types'
import type { UploadedImage } from '@/types/image'

const STATUS_BY_ACTION: Partial<Record<EventFormAction, ContentStatus>> = {
  draft: 'DRAFT',
  request: 'REQUEST',
  publish: 'PUBLISHED',
}

export interface EventFormProps {
  mode: 'create' | 'edit'
  initialValues: EventFormValues
  initialPublishedAt?: string | null
  isPending: boolean
  submissionError: Error | null
  onSubmit: (payload: CreateEventInput, action: EventFormAction) => void
  onCancel: () => void
  eventTypes: EventType[]
  isLoadingEventTypes: boolean
  canReadEventTypes: boolean
  canCreateEventType: boolean
  canPublishEvent: boolean
  canSubmitEvent: boolean
  canApproveEvent: boolean
  canRejectEvent: boolean
  onCreateEventType: (name: string) => Promise<EventType | undefined>
  authors: UserOption[]
  isLoadingUsers: boolean
  canManageAuthors: boolean
  /** Gate `user:delete` && `admin:access` — aksi hapus author (cascade konten) di dropdown. */
  canDeleteAuthors: boolean
  /** Opsi penyelenggara (tabel network). */
  networks: SearchSelectOption[]
  isLoadingNetworks: boolean
  canReadNetworks: boolean
  canCreateNetwork: boolean
  onUploadImage: (file: File) => Promise<UploadedImage>
  onUploadError: (error: unknown) => void
}

function buildLocation(values: EventFormValues['location']): EventLocationInput {
  const location: EventLocationInput = { name: values.name.trim() }
  const address = values.address.trim()
  if (address !== '') location.address = address
  const lat = Number(values.lat)
  const lng = Number(values.lng)
  if (values.lat.trim() !== '' && Number.isFinite(lat)) location.lat = lat
  if (values.lng.trim() !== '' && Number.isFinite(lng)) location.lng = lng
  return location
}

export function EventForm({
  mode,
  initialValues,
  initialPublishedAt,
  isPending,
  submissionError,
  onSubmit,
  onCancel,
  eventTypes,
  isLoadingEventTypes,
  canReadEventTypes,
  canCreateEventType,
  canPublishEvent,
  canSubmitEvent,
  canApproveEvent,
  canRejectEvent,
  onCreateEventType,
  authors,
  isLoadingUsers,
  canManageAuthors,
  canDeleteAuthors,
  networks,
  isLoadingNetworks,
  canReadNetworks,
  canCreateNetwork,
  onUploadImage,
  onUploadError,
}: EventFormProps) {
  const { t } = useTranslation()
  const schema = useMemo(() => createEventSchema(t), [t])
  const form = useForm<EventFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })

  const status = useWatch({ control: form.control, name: 'status' })

  const initialThumbnail = initialValues.thumbnail || null
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [thumbnail, setThumbnail] = useState<string | null>(initialThumbnail)
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(initialThumbnail)
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)
  const [thumbnailError, setThumbnailError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    action: EventFormAction
    label: string
  } | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishAction, setPublishAction] = useState<'publish' | 'approve'>('publish')

  // 422 → per-field; 409 → per-field pada `slug`; keduanya tanpa toast, tetap di halaman.
  useEffect(() => {
    if (isValidationError(submissionError)) {
      form.clearErrors()
      for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
        form.setError(field as FieldPath<EventFormValues>, { type: 'server', message })
      }
      return
    }
    if (isConflictError(submissionError)) {
      form.clearErrors('slug')
      form.setError('slug', {
        type: 'server',
        message: t('event:errors.slugDuplicate'),
      })
    }
  }, [submissionError, form, t])

  const globalMessage =
    submissionError instanceof ApiError &&
    submissionError.statusCode !== 422 &&
    submissionError.statusCode !== 409
      ? submissionError.message
      : null

  function handleNameChange(value: string) {
    if (mode === 'edit' || slugTouched) return
    form.setValue('slug', slugify(value), { shouldValidate: false })
  }

  function handleGenerateSlug() {
    setSlugTouched(true)
    form.setValue('slug', slugify(form.getValues('name')), { shouldValidate: true })
  }

  async function handleThumbnailUpload(file: File) {
    setThumbnailError(null)
    setIsUploadingThumbnail(true)
    try {
      const image = await onUploadImage(file)
      const preview = image.variants.find((variant) => variant.name === 'thumbnail')?.url
      setThumbnail(image.url)
      setThumbnailPreviewUrl(preview ?? image.url)
      form.setValue('thumbnail', image.url)
    } catch (error) {
      if (isValidationError(error)) {
        setThumbnailError(t('event:thumbnail.uploadInvalid'))
      } else {
        onUploadError(error)
      }
    } finally {
      setIsUploadingThumbnail(false)
    }
  }

  function handleRemoveThumbnail() {
    setThumbnail(null)
    setThumbnailPreviewUrl(null)
    form.setValue('thumbnail', null)
  }

  function handleSubmit(values: EventFormValues, action: EventFormAction, publishedAt?: string) {
    const name = values.name.trim()
    const slug = values.slug.trim()
    const dates = values.dates
      .filter((row) => row.date.trim() !== '')
      .map((row) => {
        const entry: EventDateInput = { date: row.date }
        const startTime = row.startTime.trim()
        const endTime = row.endTime.trim()
        if (startTime !== '') entry.startTime = startTime
        if (endTime !== '') entry.endTime = endTime
        return entry
      })
    const payload: CreateEventInput = {
      name,
      status: STATUS_BY_ACTION[action] ?? values.status,
      visibility: values.visibility,
      eventTypeIds: values.eventTypeIds,
      authorIds: values.authorIds,
      // Selalu dikirim: `null` = clear saat edit, diabaikan backend saat create.
      networkId: values.networkId.trim() === '' ? null : values.networkId,
      location: buildLocation(values.location),
      ...(publishedAt ? { publishedAt: new Date(publishedAt).toISOString() } : {}),
      ...(slug ? { slug } : {}),
      ...(values.content ? { content: values.content } : {}),
    }
    // Edit selalu kirim `dates` (termasuk `[]`) agar bisa dikosongkan; create hanya bila ada isi.
    if (mode === 'edit' || dates.length > 0) payload.dates = dates
    // Hanya kirim `thumbnail` bila berubah: hapus → `null`, ganti → url baru.
    if (thumbnail !== initialThumbnail) payload.thumbnail = thumbnail
    onSubmit(payload, action)
  }

  function runSubmit(action: EventFormAction, publishedAt?: string) {
    void form.handleSubmit((values) => handleSubmit(values, action, publishedAt))()
  }

  async function openPublishDialog(action: 'publish' | 'approve') {
    const valid = await form.trigger()
    if (!valid) return
    setPublishAction(action)
    setPublishOpen(true)
  }

  async function requestStatusChange(action: EventFormAction, label: string) {
    const valid = await form.trigger()
    if (!valid) return
    setConfirmAction({ action, label })
    setConfirmOpen(true)
  }

  const cancelButton = (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onCancel}>
      <X className="size-4" data-icon="inline-start" />
      {t('event:form.cancel')}
    </Button>
  )

  const actions = (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => runSubmit('save')}
      >
        <Save className="size-4" data-icon="inline-start" />
        {status === 'DRAFT' ? t('event:form.saveAsDraft') : t('event:form.save')}
      </Button>
      {(status === 'PUBLISHED' || (canPublishEvent && status === 'APPROVED')) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => void requestStatusChange('draft', t('event:form.saveAsDraft'))}
        >
          <Save className="size-4" data-icon="inline-start" />
          {t('event:form.saveAsDraft')}
        </Button>
      )}
      {canPublishEvent && status !== 'REQUEST' && (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => void openPublishDialog('publish')}
        >
          <CalendarClock className="size-4" data-icon="inline-start" />
          {t('event:form.publish')}
        </Button>
      )}
      {!canPublishEvent && canSubmitEvent && status === 'DRAFT' && (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => void requestStatusChange('request', t('event:form.requestPublish'))}
        >
          <Send className="size-4" data-icon="inline-start" />
          {t('event:form.requestPublish')}
        </Button>
      )}
    </>
  )

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => handleSubmit(values, 'save'))}
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

        {status === 'REQUEST' && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border bg-card px-4 py-2">
            <span className="text-sm text-muted-foreground">{t('event:workflow.requested')}</span>
            {(canApproveEvent || canRejectEvent) && (
              <div className="flex items-center gap-2">
                {canRejectEvent && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void requestStatusChange('reject', t('event:workflow.reject'))}
                  >
                    <X className="size-4" data-icon="inline-start" />
                    {t('event:workflow.reject')}
                  </Button>
                )}
                {canApproveEvent && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void openPublishDialog('approve')}
                  >
                    <Check className="size-4" data-icon="inline-start" />
                    {t('event:workflow.approve')}
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
              {actions}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setShowSettings(true)}
                aria-label={t('event:form.showSettings')}
                title={t('event:form.showSettings')}
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
                  <h2 className="text-sm font-semibold">{t('event:form.settingsTitle')}</h2>
                  <div className="flex items-center gap-2">
                    {actions}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setShowSettings(false)}
                      aria-label={t('event:form.hideSettings')}
                      title={t('event:form.hideSettings')}
                    >
                      <PanelRightClose className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                  <EventMetaPanel
                    form={form}
                    slugTouched={slugTouched}
                    onNameChange={handleNameChange}
                    onSlugTouched={() => setSlugTouched(true)}
                    onGenerateSlug={handleGenerateSlug}
                    thumbnail={thumbnail}
                    thumbnailPreviewUrl={thumbnailPreviewUrl}
                    isUploadingThumbnail={isUploadingThumbnail}
                    thumbnailError={thumbnailError}
                    onUploadThumbnail={(file) => void handleThumbnailUpload(file)}
                    onRemoveThumbnail={handleRemoveThumbnail}
                    eventTypes={eventTypes}
                    isLoadingEventTypes={isLoadingEventTypes}
                    canReadEventTypes={canReadEventTypes}
                    canCreateEventType={canCreateEventType}
                    onCreateEventType={onCreateEventType}
                    authors={authors}
                    isLoadingUsers={isLoadingUsers}
                    canManageAuthors={canManageAuthors}
                    canDeleteAuthors={canDeleteAuthors}
                    networks={networks}
                    isLoadingNetworks={isLoadingNetworks}
                    canReadNetworks={canReadNetworks}
                    canCreateNetwork={canCreateNetwork}
                    disabled={isPending}
                  />
                </div>
              </div>
            </aside>
          )}
        </div>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('event:confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('event:confirm.description', { action: confirmAction?.label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="size-4" data-icon="inline-start" />
              {t('event:form.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                const action = confirmAction?.action
                setConfirmOpen(false)
                if (action) runSubmit(action)
              }}
            >
              <Check className="size-4" data-icon="inline-start" />
              {t('event:confirm.submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PublishScheduleDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onConfirm={(publishedAt) =>
          runSubmit(publishAction === 'approve' ? 'approve' : 'publish', publishedAt)
        }
        isPending={isPending}
        defaultValue={initialPublishedAt ?? new Date().toISOString()}
        title={t('event:publishDialog.title')}
        description={t('event:publishDialog.description')}
        dateLabel={t('event:publishDialog.dateLabel')}
        datePlaceholder={t('event:publishDialog.datePlaceholder')}
        nextLabel={t('event:confirm.submit')}
        confirmTitle={t('event:confirm.title')}
        confirmDescription={t('event:publishDialog.confirmDescription')}
        confirmLabel={
          publishAction === 'approve'
            ? t('event:workflow.approve')
            : t('event:publishDialog.confirm')
        }
        cancelLabel={t('event:form.cancel')}
      />
    </Form>
  )
}
