import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getApiErrorMessage,
  isConflictError,
  isValidationError,
  toastError,
  toastSuccess,
} from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { useUsers } from '@/features/user/hooks/use-users'
import { ArchiveForm } from '@/features/archive/components/archive-form'
import type { ArchiveFormValues } from '@/features/archive/lib/schema'
import { useApproveArchive } from '@/features/archive/hooks/use-approve-archive'
import { useArchive } from '@/features/archive/hooks/use-archive'
import { useCategories } from '@/features/archive/hooks/use-categories'
import { useCreateCategory } from '@/features/archive/hooks/use-create-category'
import { useRejectArchive } from '@/features/archive/hooks/use-reject-archive'
import { useSubmitArchive } from '@/features/archive/hooks/use-submit-archive'
import { useUpdateArchive } from '@/features/archive/hooks/use-update-archive'
import { useUploadDocument } from '@/features/archive/hooks/use-upload-document'
import { useUploadImage } from '@/features/archive/hooks/use-upload-image'
import type {
  Archive,
  ArchiveCategory,
  ArchiveFormAction,
  UpdateArchiveInput,
} from '@/features/archive/types'

function toFormValues(archive: Archive): ArchiveFormValues {
  return {
    name: archive.name,
    description: archive.description ?? '',
    thumbnail: archive.thumbnail ?? '',
    type: archive.type,
    status: archive.status,
    publishedAt: archive.publishedAt ?? '',
    categoryIds: archive.categories.map((category) => category.id),
    authorIds: archive.authors.map((author) => author.id),
    externalLinks: archive.externalLinks ?? [],
  }
}

export function ArchiveEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { can } = useAuthPermissions()

  const canUpdate = can('archive:update')
  const canReadCategories = can('category:read')
  const canCreateCategory = can('category:create')
  const canDeleteCategory = can('category:delete')
  const canManageAuthors = can('user:create') && can('user:read')
  const canDeleteAuthors = can('user:delete') && can('admin:access')
  const canPublishArchive = can('archive:publish')
  const canSubmitArchive = can('archive:submit')
  const canApproveArchive = can('archive:approve')
  const canRejectArchive = can('archive:reject')

  const archiveQuery = useArchive(id)
  const categoriesQuery = useCategories(canReadCategories)
  const usersQuery = useUsers({ page: 1, limit: 100, enabled: canManageAuthors })
  const updateArchive = useUpdateArchive()
  const submitArchive = useSubmitArchive()
  const approveArchive = useApproveArchive()
  const rejectArchive = useRejectArchive()
  const createCategory = useCreateCategory()
  const uploadImage = useUploadImage()
  const uploadDocument = useUploadDocument()

  async function handleCreateCategory(name: string): Promise<ArchiveCategory | undefined> {
    try {
      return await createCategory.mutateAsync({ name, type: 'ARCHIVE' })
    } catch (err: unknown) {
      if (!isValidationError(err)) {
        toastError(getApiErrorMessage(err, t('archive:errors.createCategoryFailed')))
      }
      return undefined
    }
  }

  function handleUploadError(err: unknown) {
    if (isValidationError(err)) return
    toastError(getApiErrorMessage(err, t('archive:errors.uploadFailed')))
  }

  async function handleSubmit(payload: UpdateArchiveInput, action: ArchiveFormAction) {
    if (!id) return
    // `approve` mengirim `publishedAt` ke endpoint approve, bukan ke PATCH
    // (PATCH `publishedAt` memaksa PUBLISHED → approve 409). `status` juga dibuang
    // untuk approve/reject — transisi yang memiliki status (cegah PATCH regresi).
    const publishedAt = payload.publishedAt
    let body: UpdateArchiveInput = payload
    if (action === 'approve' || action === 'reject') {
      body = { ...payload }
      delete body.publishedAt
      delete body.status
    }
    // Simpan perubahan field dulu. Backend mengabaikan `status` PATCH bagi non-admin.
    let updated: Archive
    try {
      updated = await updateArchive.mutateAsync({ id, payload: body })
    } catch (err: unknown) {
      // 422/409 mengalir ke form via submissionError → setError per-field; tetap di halaman.
      if (isValidationError(err) || isConflictError(err)) return
      toastError(getApiErrorMessage(err, t('archive:toast.updateFailed')))
      return
    }
    try {
      if (action === 'approve') {
        await approveArchive.mutateAsync({ id, publishedAt: publishedAt ?? undefined })
        toastSuccess(t('archive:toast.approved'))
      } else if (action === 'reject') {
        await rejectArchive.mutateAsync(id)
        toastSuccess(t('archive:toast.rejected'))
      } else {
        if (action === 'request' && updated.status === 'DRAFT') {
          await submitArchive.mutateAsync(id)
        }
        toastSuccess(t('archive:toast.updated'))
      }
    } catch (err: unknown) {
      const key =
        action === 'approve'
          ? 'archive:toast.approveFailed'
          : action === 'reject'
            ? 'archive:toast.rejectFailed'
            : 'archive:toast.updateFailed'
      toastError(getApiErrorMessage(err, t(key)))
      return
    }
    navigate('/archives')
  }

  const authorsOptions = (usersQuery.data?.items ?? []).map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  }))

  if (!canUpdate) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('archive:errors.noUpdatePermission')}</p>
        <Button variant="outline" onClick={() => navigate('/archives')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('archive:form.cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {archiveQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : archiveQuery.isError ? (
        isForbiddenError(archiveQuery.error) ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('archive:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('archive:errors.loadDetail')}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={() => void archiveQuery.refetch()}
            >
              <RefreshCw className="size-3.5" data-icon="inline-start" />
              {t('common:actions.retry')}
            </Button>
          </div>
        )
      ) : archiveQuery.data ? (
        <ArchiveForm
          key={id}
          mode="edit"
          initialValues={toFormValues(archiveQuery.data)}
          initialDocuments={archiveQuery.data.documents ?? []}
          initialPublishedAt={archiveQuery.data.publishedAt}
          isPending={
            updateArchive.isPending ||
            submitArchive.isPending ||
            approveArchive.isPending ||
            rejectArchive.isPending
          }
          submissionError={updateArchive.error}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/archives')}
          categories={categoriesQuery.data?.items ?? []}
          isLoadingCategories={categoriesQuery.isPending}
          canReadCategories={canReadCategories}
          canCreateCategory={canCreateCategory}
          canDeleteCategory={canDeleteCategory}
          canPublishArchive={canPublishArchive}
          canSubmitArchive={canSubmitArchive}
          canApproveArchive={canApproveArchive}
          canRejectArchive={canRejectArchive}
          onCreateCategory={handleCreateCategory}
          authors={authorsOptions}
          isLoadingUsers={usersQuery.isPending}
          canManageAuthors={canManageAuthors}
          canDeleteAuthors={canDeleteAuthors}
          onUploadImage={uploadImage.mutateAsync}
          onUploadDocument={uploadDocument.mutateAsync}
          onUploadError={handleUploadError}
        />
      ) : null}
    </div>
  )
}
