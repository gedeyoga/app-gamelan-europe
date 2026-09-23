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
import { StoryForm } from '@/features/story/components/story-form'
import type { StoryFormValues } from '@/features/story/lib/schema'
import { useApproveStory } from '@/features/story/hooks/use-approve-story'
import { useCategories } from '@/features/story/hooks/use-categories'
import { useCreateCategory } from '@/features/story/hooks/use-create-category'
import { useRejectStory } from '@/features/story/hooks/use-reject-story'
import { useStory } from '@/features/story/hooks/use-story'
import { useUpdateStory } from '@/features/story/hooks/use-update-story'
import { useUploadImage } from '@/features/story/hooks/use-upload-image'
import type { CreateStoryInput, Story, StoryCategory, StoryFormAction } from '@/features/story/types'

function toFormValues(story: Story): StoryFormValues {
  return {
    name: story.name,
    slug: story.slug,
    content: story.content ?? '',
    thumbnail: story.thumbnail ?? '',
    status: story.status,
    visibility: story.visibility,
    categoryIds: story.categories.map((category) => category.id),
    imageIds: [],
  }
}

export function StoryEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { can } = useAuthPermissions()

  const canUpdate = can('story:update')
  const canReadCategories = can('category:read')
  const canCreateCategory = can('category:create')
  const canPublishStory = can('story:publish')
  const canApproveStory = can('story:approve')
  const canRejectStory = can('story:reject')

  const storyQuery = useStory(id)
  const categoriesQuery = useCategories(canReadCategories)
  const updateStory = useUpdateStory()
  const approveStory = useApproveStory()
  const rejectStory = useRejectStory()
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

  async function handleSubmit(payload: CreateStoryInput, action: StoryFormAction) {
    if (!id) return
    // `approve` mengirim `publishedAt` ke endpoint approve, bukan ke PATCH
    // (PATCH `publishedAt` memaksa PUBLISHED → approve 409). `status` juga dibuang
    // untuk approve/reject — transisi yang memiliki status (cegah PATCH regresi).
    const publishedAt = payload.publishedAt
    let body: CreateStoryInput = payload
    if (action === 'approve' || action === 'reject') {
      body = { ...payload }
      delete body.publishedAt
      delete body.status
    }
    // Simpan perubahan field dulu.
    try {
      await updateStory.mutateAsync({ id, payload: body })
    } catch (err: unknown) {
      // 422/409 mengalir ke form via submissionError → setError per-field; tetap di halaman.
      if (isValidationError(err) || isConflictError(err)) return
      toastError(getApiErrorMessage(err, t('story:toast.updateFailed')))
      return
    }
    try {
      if (action === 'approve') {
        await approveStory.mutateAsync({ id, publishedAt: publishedAt ?? new Date().toISOString() })
        toastSuccess(t('story:toast.approved'))
      } else if (action === 'reject') {
        await rejectStory.mutateAsync(id)
        toastSuccess(t('story:toast.rejected'))
      } else {
        toastSuccess(t('story:toast.updated'))
      }
    } catch (err: unknown) {
      const key =
        action === 'approve'
          ? 'story:toast.approveFailed'
          : action === 'reject'
            ? 'story:toast.rejectFailed'
            : 'story:toast.updateFailed'
      toastError(getApiErrorMessage(err, t(key)))
      return
    }
    navigate('/stories')
  }

  if (!canUpdate) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('story:errors.noUpdatePermission')}</p>
        <Button variant="outline" onClick={() => navigate('/stories')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('story:form.cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      {storyQuery.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : storyQuery.isError ? (
        isForbiddenError(storyQuery.error) ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('story:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('story:errors.loadDetail')}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={() => void storyQuery.refetch()}
            >
              <RefreshCw className="size-3.5" data-icon="inline-start" />
              {t('common:actions.retry')}
            </Button>
          </div>
        )
      ) : storyQuery.data ? (
        <StoryForm
          mode="edit"
          initialValues={toFormValues(storyQuery.data)}
          initialPublishedAt={storyQuery.data.publishedAt}
          initialGallery={storyQuery.data.gallery ?? []}
          initialFlyer={storyQuery.data.flyer ?? []}
          isPending={
            updateStory.isPending || approveStory.isPending || rejectStory.isPending
          }
          submissionError={updateStory.error}
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
          onUploadImage={uploadImage.mutateAsync}
          onUploadError={handleUploadError}
        />
      ) : null}
    </div>
  )
}
