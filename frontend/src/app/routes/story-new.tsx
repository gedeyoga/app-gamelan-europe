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
import { StoryForm } from '@/features/story/components/story-form'
import type { StoryFormValues } from '@/features/story/lib/schema'
import { useCategories } from '@/features/story/hooks/use-categories'
import { useCreateCategory } from '@/features/story/hooks/use-create-category'
import { useCreateStory } from '@/features/story/hooks/use-create-story'
import { useUploadImage } from '@/features/story/hooks/use-upload-image'
import type { CreateStoryInput, StoryCategory } from '@/features/story/types'

export function StoryNewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuthPermissions()
  const { user } = useAuth()

  const canCreate = can('story:create')
  const canReadCategories = can('category:read')
  const canCreateCategory = can('category:create')
  const canManageAuthors = can('user:create') && can('user:read')
  const canDeleteAuthors = can('user:delete') && can('admin:access')
  const canPublishStory = can('story:publish')
  const canApproveStory = can('story:approve')
  const canRejectStory = can('story:reject')

  // Default author = current user saat create. Edit tetap seed dari record.
  const initialValues = useMemo<StoryFormValues>(
    () => ({
      name: '',
      slug: '',
      content: '',
      thumbnail: '',
      status: 'DRAFT',
      visibility: 'PUBLIC',
      categoryIds: [],
      authorIds: user ? [user.id] : [],
      imageIds: [],
    }),
    [user],
  )

  const categoriesQuery = useCategories(canReadCategories)
  const usersQuery = useUsers({ page: 1, limit: 100, enabled: canManageAuthors })
  const createStory = useCreateStory()
  const createCategory = useCreateCategory()
  const uploadImage = useUploadImage()

  async function handleCreateCategory(name: string): Promise<StoryCategory | undefined> {
    try {
      return await createCategory.mutateAsync({ name, type: 'STORY' })
    } catch (err: unknown) {
      if (!isValidationError(err)) {
        toastError(getApiErrorMessage(err, t('story:errors.createCategoryFailed')))
      }
      return undefined
    }
  }

  function handleUploadError(err: unknown) {
    if (isValidationError(err)) return
    toastError(getApiErrorMessage(err, t('story:errors.uploadFailed')))
  }

  function handleSubmit(payload: CreateStoryInput) {
    createStory.mutate(payload, {
      onSuccess: () => {
        toastSuccess(t('story:toast.created'))
        navigate('/stories')
      },
      onError: (err: unknown) => {
        // 422/409 mengalir ke form via submissionError → setError per-field; tetap di halaman.
        if (isValidationError(err) || isConflictError(err)) return
        toastError(getApiErrorMessage(err, t('story:toast.createFailed')))
      },
    })
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
        <p className="text-sm font-medium">{t('story:errors.noCreatePermission')}</p>
        <Button variant="outline" onClick={() => navigate('/stories')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('story:form.cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      <StoryForm
        mode="create"
        initialValues={initialValues}
        isPending={createStory.isPending}
        submissionError={createStory.error}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/stories')}
        categories={categoriesQuery.data?.items ?? []}
        isLoadingCategories={categoriesQuery.isPending}
        canReadCategories={canReadCategories}
        canCreateCategory={canCreateCategory}
        canPublishStory={canPublishStory}
        canApproveStory={canApproveStory}
        canRejectStory={canRejectStory}
        onCreateCategory={handleCreateCategory}
        authors={authorsOptions}
        isLoadingUsers={usersQuery.isPending}
        canManageAuthors={canManageAuthors}
        canDeleteAuthors={canDeleteAuthors}
        onUploadImage={uploadImage.mutateAsync}
        onUploadError={handleUploadError}
      />
    </div>
  )
}
