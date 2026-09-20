import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  Save,
  X,
} from 'lucide-react'

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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormField, FormItem, FormMessage, Form } from '@/components/ui/form'
import { DateTimePicker } from '@/components/shared/date-time-picker'
import { ApiError, isConflictError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { cn } from '@/lib/utils'

import { RichTextEditor } from '@/components/shared/rich-text-editor'
import { StoryMetaPanel } from './story-meta-panel'
import { createStorySchema, type StoryFormValues } from '../lib/schema'
import { slugify } from '../lib/slug'
import type { ContentStatus, CreateStoryInput, StoryCategory, UploadedImage } from '../types'

export interface StoryFormProps {
  mode: 'create' | 'edit'
  initialValues: StoryFormValues
  initialPublishedAt?: string | null
  initialGallery?: UploadedImage[]
  isPending: boolean
  submissionError: Error | null
  onSubmit: (payload: CreateStoryInput) => void
  onCancel: () => void
  categories: StoryCategory[]
  isLoadingCategories: boolean
  canReadCategories: boolean
  canCreateCategory: boolean
  onCreateCategory: (name: string) => Promise<StoryCategory | undefined>
  onUploadImage: (file: File) => Promise<UploadedImage>
  onUploadError: (error: unknown) => void
}

export function StoryForm({
  mode,
  initialValues,
  initialPublishedAt,
  initialGallery,
  isPending,
  submissionError,
  onSubmit,
  onCancel,
  categories,
  isLoadingCategories,
  canReadCategories,
  canCreateCategory,
  onCreateCategory,
  onUploadImage,
  onUploadError,
}: StoryFormProps) {
  const { t } = useTranslation()
  const schema = useMemo(() => createStorySchema(t), [t])
  const form = useForm<StoryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })

  const status = useWatch({ control: form.control, name: 'status' })

  const initialThumbnail = initialValues.thumbnail || null
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [thumbnail, setThumbnail] = useState<string | null>(initialThumbnail)
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(initialThumbnail)
  const [thumbnailId, setThumbnailId] = useState<string | null>(null)
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)
  const [thumbnailError, setThumbnailError] = useState<string | null>(null)
  const [inlineImageIds, setInlineImageIds] = useState<string[]>([])
  const [galleryImages, setGalleryImages] = useState<UploadedImage[]>(initialGallery ?? [])
  const [isUploadingGallery, setIsUploadingGallery] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    status: ContentStatus
    label: string
  } | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishAt, setPublishAt] = useState<string | undefined>(undefined)

  // 422 → per-field; 409 → per-field pada `slug`; keduanya tanpa toast, tetap di halaman.
  useEffect(() => {
    if (isValidationError(submissionError)) {
      form.clearErrors()
      for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
        form.setError(field as FieldPath<StoryFormValues>, { type: 'server', message })
      }
      return
    }
    if (isConflictError(submissionError)) {
      form.clearErrors('slug')
      form.setError('slug', {
        type: 'server',
        message: t('story:errors.slugDuplicate'),
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

  function handleImageUploaded(image: UploadedImage) {
    setInlineImageIds((prev) => (prev.includes(image.id) ? prev : [...prev, image.id]))
  }

  async function handleThumbnailUpload(file: File) {
    setThumbnailError(null)
    setIsUploadingThumbnail(true)
    try {
      const image = await onUploadImage(file)
      const preview = image.variants.find((variant) => variant.name === 'thumbnail')?.url
      setThumbnail(image.url)
      setThumbnailPreviewUrl(preview ?? image.url)
      setThumbnailId(image.id)
      form.setValue('thumbnail', image.url)
    } catch (error) {
      if (isValidationError(error)) {
        setThumbnailError(t('story:thumbnail.uploadInvalid'))
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
    setThumbnailId(null)
    form.setValue('thumbnail', null)
  }

  async function handleGalleryUpload(file: File) {
    setGalleryError(null)
    setIsUploadingGallery(true)
    try {
      const image = await onUploadImage(file)
      setGalleryImages((prev) => [...prev, image])
    } catch (error) {
      if (isValidationError(error)) {
        setGalleryError(t('story:gallery.uploadInvalid'))
      } else {
        onUploadError(error)
      }
    } finally {
      setIsUploadingGallery(false)
    }
  }

  function handleSubmit(values: StoryFormValues & { publishedAt?: string }) {
    const name = values.name.trim()
    const slug = values.slug.trim()
    const imageIds = Array.from(
      new Set([...inlineImageIds, ...(thumbnailId ? [thumbnailId] : [])]),
    )
    const payload: CreateStoryInput = {
      name,
      status: values.status,
      visibility: values.visibility,
      categoryIds: values.categoryIds,
      ...(values.publishedAt
        ? { publishedAt: new Date(values.publishedAt).toISOString() }
        : {}),
      ...(slug ? { slug } : {}),
      ...(values.content ? { content: values.content } : {}),
      ...(imageIds.length > 0 ? { imageIds } : {}),
    }
    // Galeri terpisah dari `imageIds` (hindari dobel); edit selalu kirim agar bisa dikosongkan.
    const galleryImageIds = galleryImages.map((image) => image.id)
    if (mode === 'edit' || galleryImageIds.length > 0) payload.galleryImageIds = galleryImageIds
    // Hanya kirim `thumbnail` bila berubah: hapus → `null`, ganti → url baru.
    if (thumbnail !== initialThumbnail) payload.thumbnail = thumbnail
    onSubmit(payload)
  }

  function submitWithStatus(next: ContentStatus, publishedAt?: string) {
    void form.handleSubmit((values) => handleSubmit({ ...values, status: next, publishedAt }))()
  }

  async function openPublishDialog() {
    const valid = await form.trigger()
    if (!valid) return
    setPublishAt(initialPublishedAt ?? new Date().toISOString())
    setPublishOpen(true)
  }

  function handleConfirmPublish() {
    setPublishOpen(false)
    if (!publishAt) return
    submitWithStatus('PUBLISHED', publishAt)
  }

  async function requestStatusChange(next: ContentStatus, label: string) {
    const valid = await form.trigger()
    if (!valid) return
    setConfirmAction({ status: next, label })
    setConfirmOpen(true)
  }

  const cancelButton = (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onCancel}>
      <X className="size-4" data-icon="inline-start" />
      {t('story:form.cancel')}
    </Button>
  )

  const saveButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" disabled={isPending}>
          <Save className="size-4" data-icon="inline-start" />
          {isPending ? t('common:actions.saving') : t('story:form.save')}
          <ChevronDown className="size-4" data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-56 p-1.5">
        {(status === 'APPROVED' || status === 'PUBLISHED') && (
          <DropdownMenuItem
            className="gap-2 py-2.5 pr-3 text-sm whitespace-nowrap"
            disabled={isPending}
            onSelect={() => void requestStatusChange(status, t('story:form.saveChanges'))}
          >
            {t('story:form.saveChanges')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="gap-2 py-2.5 pr-3 text-sm whitespace-nowrap"
          disabled={isPending}
          onSelect={() => void requestStatusChange('DRAFT', t('story:form.saveAsDraft'))}
        >
          {t('story:form.saveAsDraft')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 py-2.5 pr-3 text-sm whitespace-nowrap"
          disabled={isPending}
          onSelect={() => void requestStatusChange('REQUEST', t('story:form.requestPublish'))}
        >
          {t('story:form.requestPublish')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const publishButton =
    status === 'APPROVED' || status === 'PUBLISHED' ? (
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() => void openPublishDialog()}
      >
        <CalendarClock className="size-4" data-icon="inline-start" />
        {t('story:form.publish')}
      </Button>
    ) : null

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-1 flex-col gap-4 lg:min-h-0">
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
            <span className="text-sm text-muted-foreground">{t('story:workflow.requested')}</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => void requestStatusChange('DRAFT', t('story:workflow.reject'))}
              >
                <X className="size-4" data-icon="inline-start" />
                {t('story:workflow.reject')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={() => void requestStatusChange('APPROVED', t('story:workflow.approve'))}
              >
                <Check className="size-4" data-icon="inline-start" />
                {t('story:workflow.approve')}
              </Button>
            </div>
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
              {publishButton}
              {saveButton}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setShowSettings(true)}
                aria-label={t('story:form.showSettings')}
                title={t('story:form.showSettings')}
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
                    onImageUploaded={handleImageUploaded}
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
                  <h2 className="text-sm font-semibold">{t('story:form.settingsTitle')}</h2>
                  <div className="flex items-center gap-2">
                    {publishButton}
                    {saveButton}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setShowSettings(false)}
                      aria-label={t('story:form.hideSettings')}
                      title={t('story:form.hideSettings')}
                    >
                      <PanelRightClose className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                  <StoryMetaPanel
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
                    galleryImages={galleryImages}
                    onChangeGallery={setGalleryImages}
                    onUploadGalleryImage={(file) => void handleGalleryUpload(file)}
                    isUploadingGallery={isUploadingGallery}
                    galleryError={galleryError}
                    categories={categories}
                    isLoadingCategories={isLoadingCategories}
                    canReadCategories={canReadCategories}
                    canCreateCategory={canCreateCategory}
                    onCreateCategory={onCreateCategory}
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
            <AlertDialogTitle>{t('story:confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('story:confirm.description', { action: confirmAction?.label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="size-4" data-icon="inline-start" />
              {t('story:form.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                const next = confirmAction?.status
                setConfirmOpen(false)
                if (next) submitWithStatus(next)
              }}
            >
              <Check className="size-4" data-icon="inline-start" />
              {t('story:confirm.submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={publishOpen} onOpenChange={(open) => setPublishOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('story:publishDialog.title')}</DialogTitle>
            <DialogDescription>{t('story:publishDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="story-publish-at" className="text-sm font-medium">
              {t('story:publishDialog.dateLabel')}
            </label>
            <DateTimePicker
              id="story-publish-at"
              value={publishAt}
              onChange={setPublishAt}
              placeholder={t('story:publishDialog.datePlaceholder')}
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                <X className="size-4" data-icon="inline-start" />
                {t('story:form.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              disabled={isPending || !publishAt}
              onClick={handleConfirmPublish}
            >
              <CalendarCheck className="size-4" data-icon="inline-start" />
              {t('story:publishDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
