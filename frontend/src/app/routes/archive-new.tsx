import { useMemo } from 'react'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  getApiErrorMessage,
  isConflictError,
  isValidationError,
  toastError,
  toastSuccess,
} from '@/lib/toast'
import { useAuth } from '@/features/auth/auth-provider'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { useUsers } from '@/features/user/hooks/use-users'
import { ArchiveForm } from '@/features/archive/components/archive-form'
import type { ArchiveFormValues } from '@/features/archive/lib/schema'
import { useCategories } from '@/features/archive/hooks/use-categories'
import { useCreateArchive } from '@/features/archive/hooks/use-create-archive'
import { useCreateCategory } from '@/features/archive/hooks/use-create-category'
import { useSubmitArchive } from '@/features/archive/hooks/use-submit-archive'
import { useUploadDocument } from '@/features/archive/hooks/use-upload-document'
import { useUploadImage } from '@/features/archive/hooks/use-upload-image'
import type {
  Archive,
  ArchiveCategory,
  ArchiveFormAction,
  CreateArchiveInput,
  UpdateArchiveInput,
} from '@/features/archive/types'

export function ArchiveNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuthPermissions()
  const { user } = useAuth()

  const canCreate = can('archive:create')
  const canReadCategories = can('category:read')
  const canCreateCategory = can('category:create')
  const canManageAuthors = can('user:create') && can('user:read')
  const canDeleteAuthors = can('user:delete') && can('admin:access')
  const canPublishArchive = can('archive:publish')
  const canSubmitArchive = can('archive:submit')
  const canApproveArchive = can('archive:approve')
  const canRejectArchive = can('archive:reject')

  // Default author = current user saat create. Edit tetap seed dari record.
  const initialValues = useMemo<ArchiveFormValues>(
    () => ({
      name: '',
      description: '',
      thumbnail: '',
      type: 'PUBLIC',
      status: 'DRAFT',
      publishedAt: '',
      categoryIds: [],
      authorIds: user ? [user.id] : [],
      externalLinks: [],
    }),
    [user],
  )

  const categoriesQuery = useCategories(canReadCategories)
  const usersQuery = useUsers({ page: 1, limit: 100, enabled: canManageAuthors })
  const createArchive = useCreateArchive()
  const submitArchive = useSubmitArchive()
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
    // Backend mengabaikan `status` create bagi non-admin → buat draft dulu, lalu panggil endpoint submit.
    const isRequest = action === 'request'
    const createPayload: CreateArchiveInput = {
      ...payload,
      name: payload.name ?? '',
      // Create: form tidak pernah mengirim `null`.
      thumbnail: payload.thumbnail ?? undefined,
      publishedAt: payload.publishedAt ?? undefined,
    }
    let created: Archive
    try {
      created = await createArchive.mutateAsync(
        isRequest ? { ...createPayload, status: 'DRAFT' } : createPayload,
      )
    } catch (err: unknown) {
      // 422/409 create mengalir ke form via submissionError → per-field; tetap di halaman.
      if (isValidationError(err) || isConflictError(err)) return
      toastError(getApiErrorMessage(err, t('archive:toast.createFailed')))
      return
    }
    if (isRequest) {
      try {
        await submitArchive.mutateAsync(created.id)
      } catch (err: unknown) {
        // Submit gagal: archive sudah terbuat sebagai draft — jangan biarkan submit ulang membuat duplikat.
        toastError(getApiErrorMessage(err, t('archive:toast.createFailed')))
        navigate(`/archives/${created.id}/edit`)
        return
      }
    }
    toastSuccess(t('archive:toast.created'))
    navigate('/archives')
  }

  const authorsOptions = (usersQuery.data?.items ?? []).map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  }))

  if (!canCreate) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('archive:errors.noCreatePermission')}</p>
        <Button variant="outline" onClick={() => navigate('/archives')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('archive:form.cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <ArchiveForm
        mode="create"
        initialValues={initialValues}
        isPending={createArchive.isPending || submitArchive.isPending}
        submissionError={createArchive.error}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/archives')}
        categories={categoriesQuery.data?.items ?? []}
        isLoadingCategories={categoriesQuery.isPending}
        canReadCategories={canReadCategories}
        canCreateCategory={canCreateCategory}
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
    </div>
  )
}
