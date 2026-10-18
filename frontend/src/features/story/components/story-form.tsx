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
import { PublishScheduleDialog } from '@/components/shared/publish-schedule-dialog'
import { ApiError, isConflictError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'
import { cn } from '@/lib/utils'

import { RichTextEditor } from '@/components/shared/rich-text-editor'
import type { UserOption } from '@/components/shared/user-combobox'
import { StoryMetaPanel } from './story-meta-panel'
import { createStorySchema, type StoryFormValues } from '../lib/schema'
import { slugify } from '../lib/slug'
import type {
  ContentStatus,
  CreateStoryInput,
  FlyerGroup,
  StoryCategory,
  StoryFormAction,
  UploadedImage,
} from '../types'

const STATUS_BY_ACTION: Partial<Record<StoryFormAction, ContentStatus>> = {
  draft: 'DRAFT',
  request: 'REQUEST',
  publish: 'PUBLISHED',
}

export interface StoryFormProps {
  mode: 'create' | 'edit'
  initialValues: StoryFormValues
  initialPublishedAt?: string | null
  initialGallery?: UploadedImage[]
  initialFlyer?: FlyerGroup[]
  isPending: boolean
  submissionError: Error | null
  onSubmit: (payload: CreateStoryInput, action: StoryFormAction) => void
  onCancel: () => void
  categories: StoryCategory[]
  isLoadingCategories: boolean
  canReadCategories: boolean
  canCreateCategory: boolean
  /** Gate `category:delete` — aksi hapus kategori di combobox. */
  canDeleteCategory: boolean
  canPublishStory: boolean
  canSubmitStory: boolean
  canApproveStory: boolean
  canRejectStory: boolean
  onCreateCategory: (name: string) => Promise<StoryCategory | undefined>
  authors: UserOption[]
  isLoadingUsers: boolean
  canManageAuthors: boolean
  /** Gate `user:delete` && `admin:access` — aksi hapus author (cascade konten) di dropdown. */
  canDeleteAuthors: boolean
  onUploadImage: (file: File) => Promise<UploadedImage>
  onUploadError: (error: unknown) => void
}

export function StoryForm({
  mode,
  initialValues,
  initialPublishedAt,
  initialGallery,
  initialFlyer,
  isPending,
  submissionError,
  onSubmit,
  onCancel,
  categories,
  isLoadingCategories,
  canReadCategories,
  canCreateCategory,
  canDeleteCategory,
  canPublishStory,
  canSubmitStory,
  canApproveStory,
  canRejectStory,
  onCreateCategory,
  authors,
  isLoadingUsers,
  canManageAuthors,
  canDeleteAuthors,
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
  const [flyerGroups, setFlyerGroups] = useState<FlyerGroup[]>(initialFlyer ?? [])
  const [uploadingFlyerType, setUploadingFlyerType] = useState<string | null>(null)
  const [flyerErrors, setFlyerErrors] = useState<Record<string, string | null>>({})
  const [showSettings, setShowSettings] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    action: StoryFormAction
    label: string
  } | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishAction, setPublishAction] = useState<'publish' | 'approve'>('publish')

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

  async function handleFlyerUpload(type: string, file: File) {
    setFlyerErrors((prev) => ({ ...prev, [type]: null }))
    setUploadingFlyerType(type)
    try {
      const image = await onUploadImage(file)
      setFlyerGroups((prev) =>
        prev.map((group) =>
          group.type === type ? { ...group, images: [...group.images, image] } : group,
        ),
      )
    } catch (error) {
      if (isValidationError(error)) {
        setFlyerErrors((prev) => ({ ...prev, [type]: t('story:flyer.uploadInvalid') }))
      } else {
        onUploadError(error)
      }
    } finally {
      setUploadingFlyerType(null)
    }
  }

  function handleSubmit(
    values: StoryFormValues,
    action: StoryFormAction,
    publishedAt?: string,
    notify?: boolean,
  ) {
    const name = values.name.trim()
    const slug = values.slug.trim()
    const imageIds = Array.from(
      new Set([...inlineImageIds, ...(thumbnailId ? [thumbnailId] : [])]),
    )
    const payload: CreateStoryInput = {
      name,
      status: STATUS_BY_ACTION[action] ?? values.status,
      visibility: values.visibility,
      categoryIds: values.categoryIds,
      authorIds: values.authorIds,
      ...(publishedAt ? { publishedAt: new Date(publishedAt).toISOString() } : {}),
      ...(slug ? { slug } : {}),
      ...(values.content ? { content: values.content } : {}),
      ...(imageIds.length > 0 ? { imageIds } : {}),
      ...((action === 'approve' || action === 'publish') && notify !== undefined
        ? { notify }
        : {}),
    }
    // Galeri terpisah dari `imageIds` (hindari dobel); edit selalu kirim agar bisa dikosongkan.
    const galleryImageIds = galleryImages.map((image) => image.id)
    if (mode === 'edit' || galleryImageIds.length > 0) payload.galleryImageIds = galleryImageIds
    // Flyer terpisah dari `imageIds`; edit selalu kirim agar semua grup bisa dikosongkan.
    const flyerItems = flyerGroups
      .filter((group) => group.images.length > 0)
      .map((group) => ({ type: group.type, imageIds: group.images.map((image) => image.id) }))
    if (mode === 'edit' || flyerItems.length > 0) payload.flyerItems = flyerItems
    // Hanya kirim `thumbnail` bila berubah: hapus → `null`, ganti → url baru.
    if (thumbnail !== initialThumbnail) payload.thumbnail = thumbnail
    onSubmit(payload, action)
  }

  function runSubmit(action: StoryFormAction, publishedAt?: string, notify?: boolean) {
    void form.handleSubmit((values) => handleSubmit(values, action, publishedAt, notify))()
  }

  async function openPublishDialog(action: 'publish' | 'approve') {
    const valid = await form.trigger()
    if (!valid) return
    // Sudah punya jadwal tayang → langsung submit tanpa dialog.
    if (initialPublishedAt) {
      runSubmit(action, initialPublishedAt)
      return
    }
    setPublishAction(action)
    setPublishOpen(true)
  }

  async function requestStatusChange(action: StoryFormAction, label: string) {
    const valid = await form.trigger()
    if (!valid) return
    setConfirmAction({ action, label })
    setConfirmOpen(true)
  }

  const cancelButton = (
    <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onCancel}>
      <X className="size-4" data-icon="inline-start" />
      {t('story:form.cancel')}
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
        {status === 'DRAFT' ? t('story:form.saveAsDraft') : t('story:form.save')}
      </Button>
      {(status === 'PUBLISHED' || (canPublishStory && status === 'APPROVED')) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => void requestStatusChange('draft', t('story:form.saveAsDraft'))}
        >
          <Save className="size-4" data-icon="inline-start" />
          {t('story:form.saveAsDraft')}
        </Button>
      )}
      {canPublishStory && status !== 'REQUEST' && (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => void openPublishDialog('publish')}
        >
          <CalendarClock className="size-4" data-icon="inline-start" />
          {t('story:form.publish')}
        </Button>
      )}
      {!canPublishStory && canSubmitStory && status === 'DRAFT' && (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => void requestStatusChange('request', t('story:form.requestPublish'))}
        >
          <Send className="size-4" data-icon="inline-start" />
          {t('story:form.requestPublish')}
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
            <span className="text-sm text-muted-foreground">{t('story:workflow.requested')}</span>
            {(canApproveStory || canRejectStory) && (
              <div className="flex items-center gap-2">
                {canRejectStory && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void requestStatusChange('reject', t('story:workflow.reject'))}
                  >
                    <X className="size-4" data-icon="inline-start" />
                    {t('story:workflow.reject')}
                  </Button>
                )}
                {canApproveStory && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void openPublishDialog('approve')}
                  >
                    <Check className="size-4" data-icon="inline-start" />
                    {t('story:workflow.approve')}
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
                    {actions}
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
                    flyerGroups={flyerGroups}
                    onChangeFlyerGroups={setFlyerGroups}
                    onUploadFlyerImage={(type, file) => void handleFlyerUpload(type, file)}
                    uploadingFlyerType={uploadingFlyerType}
                    flyerErrors={flyerErrors}
                    categories={categories}
                    isLoadingCategories={isLoadingCategories}
                    canReadCategories={canReadCategories}
                    canCreateCategory={canCreateCategory}
                    canDeleteCategory={canDeleteCategory}
                    onCreateCategory={onCreateCategory}
                    authors={authors}
                    isLoadingUsers={isLoadingUsers}
                    canManageAuthors={canManageAuthors}
                    canDeleteAuthors={canDeleteAuthors}
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
                const action = confirmAction?.action
                setConfirmOpen(false)
                if (action) runSubmit(action)
              }}
            >
              <Check className="size-4" data-icon="inline-start" />
              {t('story:confirm.submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PublishScheduleDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onConfirm={(publishedAt, notify) =>
          runSubmit(publishAction === 'approve' ? 'approve' : 'publish', publishedAt, notify)
        }
        isPending={isPending}
        defaultValue={initialPublishedAt ?? new Date().toISOString()}
        title={t('story:publishDialog.title')}
        description={t('story:publishDialog.description')}
        dateLabel={t('story:publishDialog.dateLabel')}
        datePlaceholder={t('story:publishDialog.datePlaceholder')}
        nextLabel={t('story:confirm.submit')}
        confirmTitle={t('story:confirm.title')}
        confirmDescription={t('story:publishDialog.confirmDescription')}
        confirmLabel={
          publishAction === 'approve'
            ? t('story:workflow.approve')
            : t('story:publishDialog.confirm')
        }
        cancelLabel={t('story:form.cancel')}
        notifyLabel={t('story:publishDialog.notifyLabel')}
      />
    </Form>
  )
}
