import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Check, Save, Send, X } from 'lucide-react'

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { CategoryCombobox, type CategoryOption } from '@/components/shared/category-combobox'
import { UserCombobox, type UserOption } from '@/components/shared/user-combobox'
import { PublishScheduleDialog } from '@/components/shared/publish-schedule-dialog'
import { ThumbnailUpload } from '@/components/shared/thumbnail-upload'
import { useAuth } from '@/features/auth/auth-provider'
import { AuthorCreateDialog } from '@/features/user/components/author-create-dialog'
import { AuthorDeleteDialog } from '@/features/user/components/author-delete-dialog'
import { ApiError, isValidationError } from '@/lib/api-client'
import { mapApiFieldErrors } from '@/lib/field-errors'

import { DocumentUpload } from './document-upload'
import { ExternalLinksInput } from './external-links-input'
import { CategoryDeleteDialog } from './category-delete-dialog'
import { createArchiveSchema, type ArchiveFormValues } from '../lib/schema'
import { ARCHIVE_TYPES } from '../types'
import type {
  ArchiveCategory,
  ArchiveDocument,
  ArchiveFormAction,
  ArchiveStatus,
  UpdateArchiveInput,
  UploadedImage,
} from '../types'

const STATUS_BY_ACTION: Partial<Record<ArchiveFormAction, ArchiveStatus>> = {
  draft: 'DRAFT',
  request: 'REQUEST',
  publish: 'PUBLISHED',
}

/** Ambil pesan error pertama dari error zod (termasuk array item). */
function firstErrorMessage(error: unknown): string | null {
  if (!error) return null
  if (Array.isArray(error)) {
    for (const item of error) {
      const message = firstErrorMessage(item)
      if (message) return message
    }
    return null
  }
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' && message.length > 0 ? message : null
  }
  return null
}

export interface ArchiveFormProps {
  mode: 'create' | 'edit'
  initialValues: ArchiveFormValues
  initialDocuments?: ArchiveDocument[]
  initialPublishedAt?: string | null
  isPending: boolean
  submissionError: Error | null
  onSubmit: (payload: UpdateArchiveInput, action: ArchiveFormAction) => void
  onCancel: () => void
  categories: ArchiveCategory[]
  isLoadingCategories: boolean
  canReadCategories: boolean
  canCreateCategory: boolean
  /** Gate `category:delete` — aksi hapus kategori di combobox. */
  canDeleteCategory: boolean
  canPublishArchive: boolean
  canSubmitArchive: boolean
  canApproveArchive: boolean
  canRejectArchive: boolean
  onCreateCategory: (name: string) => Promise<ArchiveCategory | undefined>
  authors: UserOption[]
  isLoadingUsers: boolean
  canManageAuthors: boolean
  /** Gate `user:delete` && `admin:access` — aksi hapus author (cascade konten) di dropdown. */
  canDeleteAuthors: boolean
  onUploadImage: (file: File) => Promise<UploadedImage>
  onUploadDocument: (file: File) => Promise<ArchiveDocument>
  onUploadError: (error: unknown) => void
}

export function ArchiveForm({
  mode,
  initialValues,
  initialDocuments,
  initialPublishedAt,
  isPending,
  submissionError,
  onSubmit,
  onCancel,
  categories,
  isLoadingCategories,
  canReadCategories,
  canCreateCategory,
  canDeleteCategory,
  canPublishArchive,
  canSubmitArchive,
  canApproveArchive,
  canRejectArchive,
  onCreateCategory,
  authors,
  isLoadingUsers,
  canManageAuthors,
  canDeleteAuthors,
  onUploadImage,
  onUploadDocument,
  onUploadError,
}: ArchiveFormProps) {
  const { t } = useTranslation()
  const { user: sessionUser } = useAuth()
  const schema = useMemo(() => createArchiveSchema(t), [t])
  const form = useForm<ArchiveFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })

  const status = useWatch({ control: form.control, name: 'status' })

  const initialThumbnail = initialValues.thumbnail || null
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(initialThumbnail)
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)
  const [thumbnailError, setThumbnailError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<ArchiveDocument[]>(initialDocuments ?? [])
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishAction, setPublishAction] = useState<'publish' | 'approve'>('publish')
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false)
  const [deletingAuthor, setDeletingAuthor] = useState<UserOption | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<CategoryOption | null>(null)
  const [createdAuthors, setCreatedAuthors] = useState<UserOption[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    action: ArchiveFormAction
    label: string
  } | null>(null)

  const thumbnail = useWatch({ control: form.control, name: 'thumbnail' })

  // Gabung author baru (belum tentu muncul di `authors`) + dedupe terhadap prop.
  const authorOptions = useMemo(() => {
    const seen = new Set(authors.map((author) => author.id))
    return [...authors, ...createdAuthors.filter((author) => !seen.has(author.id))]
  }, [authors, createdAuthors])

  function handleAuthorCreated(author: UserOption) {
    setCreatedAuthors((prev) =>
      prev.some((item) => item.id === author.id) ? prev : [...prev, author],
    )
  }

  function handleAuthorDeleted(authorId: string) {
    setCreatedAuthors((prev) => prev.filter((author) => author.id !== authorId))
    form.setValue(
      'authorIds',
      (form.getValues('authorIds') ?? []).filter((id) => id !== authorId),
      { shouldDirty: true, shouldValidate: true },
    )
  }

  function handleCategoryDeleted(categoryId: string) {
    form.setValue(
      'categoryIds',
      (form.getValues('categoryIds') ?? []).filter((id) => id !== categoryId),
      { shouldDirty: true, shouldValidate: true },
    )
  }

  // 422 → per-field; tetap di halaman (tanpa toast).
  useEffect(() => {
    if (!isValidationError(submissionError)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(submissionError))) {
      form.setError(field as FieldPath<ArchiveFormValues>, { type: 'server', message })
    }
  }, [submissionError, form])

  const globalMessage =
    submissionError instanceof ApiError && submissionError.statusCode !== 422
      ? submissionError.message
      : null

  const externalLinksError = firstErrorMessage(form.formState.errors.externalLinks)

  async function handleThumbnailUpload(file: File) {
    setThumbnailError(null)
    setIsUploadingThumbnail(true)
    try {
      const image = await onUploadImage(file)
      const preview = image.variants.find((variant) => variant.name === 'thumbnail')?.url
      form.setValue('thumbnail', image.url)
      setThumbnailPreviewUrl(preview ?? image.url)
    } catch (error) {
      if (isValidationError(error)) {
        setThumbnailError(t('archive:thumbnail.uploadInvalid'))
      } else {
        onUploadError(error)
      }
    } finally {
      setIsUploadingThumbnail(false)
    }
  }

  function handleRemoveThumbnail() {
    form.setValue('thumbnail', '')
    setThumbnailPreviewUrl(null)
  }

  async function handleDocumentUpload(file: File) {
    setDocumentError(null)
    setIsUploadingDocument(true)
    try {
      const document = await onUploadDocument(file)
      setDocuments((prev) => [...prev, document])
    } catch (error) {
      if (isValidationError(error)) {
        setDocumentError(t('archive:document.uploadInvalid'))
      } else {
        onUploadError(error)
      }
    } finally {
      setIsUploadingDocument(false)
    }
  }

  function buildPayload(
    values: ArchiveFormValues,
    action: ArchiveFormAction,
    publishedAtOverride?: string,
  ): UpdateArchiveInput {
    const externalLinks = values.externalLinks
      .map((link) => link.trim())
      .filter((link) => link.length > 0)
    const documentIds = documents.map((document) => document.id)
    const thumbnailUrl = values.thumbnail.trim()

    const payload: UpdateArchiveInput = {
      name: values.name.trim(),
      type: values.type,
      status: STATUS_BY_ACTION[action] ?? values.status,
      categoryIds: values.categoryIds,
      authorIds: values.authorIds,
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
    }

    // `approve`/`publish` mengirim tanggal override; `PUBLISHED` tanpa override mempertahankan
    // tanggal lama (atau now). `DRAFT`/`REQUEST` wajib OMIT (backend memaksa PUBLISHED begitu
    // ada tanggal non-null).
    if (publishedAtOverride) {
      payload.publishedAt = new Date(publishedAtOverride).toISOString()
    } else if (payload.status === 'PUBLISHED') {
      payload.publishedAt = new Date(values.publishedAt || new Date().toISOString()).toISOString()
    }

    if (mode === 'edit') {
      // Edit selalu kirim array (replace) + `thumbnail` (null = hapus).
      payload.description = values.description.trim()
      payload.thumbnail = thumbnailUrl.length > 0 ? thumbnailUrl : null
      payload.externalLinks = externalLinks
      payload.documentIds = documentIds
    } else {
      if (thumbnailUrl.length > 0) payload.thumbnail = thumbnailUrl
      if (externalLinks.length > 0) payload.externalLinks = externalLinks
      if (documentIds.length > 0) payload.documentIds = documentIds
    }

    return payload
  }

  function runSubmit(action: ArchiveFormAction, publishedAt?: string) {
    void form.handleSubmit((values) => onSubmit(buildPayload(values, action, publishedAt), action))()
  }

  async function openPublishDialog(action: 'publish' | 'approve') {
    const valid = await form.trigger()
    if (!valid) return
    setPublishAction(action)
    setPublishOpen(true)
  }

  async function requestStatusChange(action: ArchiveFormAction, label: string) {
    const valid = await form.trigger()
    if (!valid) return
    setConfirmAction({ action, label })
    setConfirmOpen(true)
  }

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
        {status === 'DRAFT' ? t('archive:form.saveAsDraft') : t('archive:form.save')}
      </Button>
      {(status === 'PUBLISHED' || (canPublishArchive && status === 'APPROVED')) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => void requestStatusChange('draft', t('archive:form.saveAsDraft'))}
        >
          <Save className="size-4" data-icon="inline-start" />
          {t('archive:form.saveAsDraft')}
        </Button>
      )}
      {canPublishArchive && status !== 'REQUEST' && (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => void openPublishDialog('publish')}
        >
          <CalendarClock className="size-4" data-icon="inline-start" />
          {t('archive:form.publish')}
        </Button>
      )}
      {!canPublishArchive && canSubmitArchive && status === 'DRAFT' && (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => void requestStatusChange('request', t('archive:form.requestPublish'))}
        >
          <Send className="size-4" data-icon="inline-start" />
          {t('archive:form.requestPublish')}
        </Button>
      )}
    </>
  )

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(buildPayload(values, 'save'), 'save'))}
        className="mx-auto flex w-full max-w-5xl flex-col gap-6"
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
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2">
            <span className="text-sm text-muted-foreground">{t('archive:workflow.requested')}</span>
            {(canApproveArchive || canRejectArchive) && (
              <div className="flex items-center gap-2">
                {canRejectArchive && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void requestStatusChange('reject', t('archive:workflow.reject'))}
                  >
                    <X className="size-4" data-icon="inline-start" />
                    {t('archive:workflow.reject')}
                  </Button>
                )}
                {canApproveArchive && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void openPublishDialog('approve')}
                  >
                    <Check className="size-4" data-icon="inline-start" />
                    {t('archive:workflow.approve')}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 1 — Informasi */}
        <Card>
          <CardHeader>
            <CardTitle>{t('archive:form.sectionInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('archive:form.titleLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('archive:form.titlePlaceholder')}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('archive:form.descriptionLabel')}</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={5} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('archive:form.type')}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          className="flex flex-row gap-4"
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isPending}
                        >
                          {ARCHIVE_TYPES.map((value) => (
                            <div key={value} className="flex items-center gap-2">
                              <RadioGroupItem id={`archive-type-${value}`} value={value} />
                              <Label htmlFor={`archive-type-${value}`}>
                                {t(`archive:typeOptions.${value}`)}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('archive:form.categories')}</FormLabel>
                      <CategoryCombobox
                        i18nPrefix="archive"
                        options={categories}
                        value={field.value}
                        onChange={field.onChange}
                        isLoading={isLoadingCategories}
                        disabled={!canReadCategories || isPending}
                        canCreate={canCreateCategory}
                        onCreate={onCreateCategory}
                        canDeleteOption={(option) =>
                          canDeleteCategory && !field.value.includes(option.id)
                        }
                        onDeleteOption={setDeletingCategory}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {canManageAuthors && (
                  <FormField
                    control={form.control}
                    name="authorIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('archive:form.authors')}</FormLabel>
                        <UserCombobox
                          options={authorOptions}
                          value={field.value}
                          onChange={field.onChange}
                          isLoading={isLoadingUsers}
                          disabled={isPending}
                          canCreate={canManageAuthors}
                          onCreateClick={() => setAuthorDialogOpen(true)}
                          canDeleteOption={(option) =>
                            canDeleteAuthors &&
                            option.id !== sessionUser?.id &&
                            !field.value.includes(option.id)
                          }
                          onDeleteOption={setDeletingAuthor}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t('archive:form.thumbnail')}</span>
                <ThumbnailUpload
                  i18nPrefix="archive"
                  value={thumbnail || null}
                  previewUrl={thumbnailPreviewUrl}
                  isUploading={isUploadingThumbnail}
                  error={thumbnailError}
                  disabled={isPending}
                  onUpload={(file) => void handleThumbnailUpload(file)}
                  onRemove={handleRemoveThumbnail}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2 — Link & Dokumen */}
        <Card>
          <CardHeader>
            <CardTitle>{t('archive:form.sectionLinks')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FormField
              control={form.control}
              name="externalLinks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('archive:form.externalLinks')}</FormLabel>
                  <ExternalLinksInput
                    value={field.value}
                    onChange={field.onChange}
                    error={externalLinksError}
                    disabled={isPending}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('archive:form.documents')}</span>
              <DocumentUpload
                value={documents}
                onChange={setDocuments}
                onUpload={(file) => void handleDocumentUpload(file)}
                isUploading={isUploadingDocument}
                error={documentError}
                disabled={isPending}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onCancel}>
            <X className="size-4" data-icon="inline-start" />
            {t('archive:form.cancel')}
          </Button>
          {actions}
        </div>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archive:confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('archive:confirm.description', { action: confirmAction?.label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="size-4" data-icon="inline-start" />
              {t('archive:form.cancel')}
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
              {t('archive:confirm.submit')}
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
        title={t('archive:publishDialog.title')}
        description={t('archive:publishDialog.description')}
        dateLabel={t('archive:publishDialog.dateLabel')}
        datePlaceholder={t('archive:publishDialog.datePlaceholder')}
        nextLabel={t('archive:publishDialog.next')}
        confirmTitle={t('archive:publishDialog.confirmTitle')}
        confirmDescription={t('archive:publishDialog.confirmDescription')}
        confirmLabel={
          publishAction === 'approve'
            ? t('archive:workflow.approve')
            : t('archive:publishDialog.confirm')
        }
        cancelLabel={t('archive:form.cancel')}
      />

      {canManageAuthors && (
        <>
          <AuthorCreateDialog
            open={authorDialogOpen}
            onOpenChange={setAuthorDialogOpen}
            onCreated={handleAuthorCreated}
          />
          {canDeleteAuthors && (
            <AuthorDeleteDialog
              open={Boolean(deletingAuthor)}
              onOpenChange={(open) => {
                if (!open) setDeletingAuthor(null)
              }}
              author={deletingAuthor}
              onDeleted={handleAuthorDeleted}
            />
          )}
        </>
      )}

      {canDeleteCategory && (
        <CategoryDeleteDialog
          open={Boolean(deletingCategory)}
          onOpenChange={(open) => {
            if (!open) setDeletingCategory(null)
          }}
          category={deletingCategory}
          onDeleted={handleCategoryDeleted}
        />
      )}
    </Form>
  )
}
