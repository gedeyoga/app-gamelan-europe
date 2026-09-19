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
import { useCategories } from '@/features/story/hooks/use-categories'
import { useCreateCategory } from '@/features/story/hooks/use-create-category'
import { useStory } from '@/features/story/hooks/use-story'
import { useUpdateStory } from '@/features/story/hooks/use-update-story'
import { useUploadImage } from '@/features/story/hooks/use-upload-image'
import type { CreateStoryInput, Story, StoryCategory } from '@/features/story/types'

function toFormValues(story: Story): StoryFormValues {
  return {
    name: story.name,
    slug: story.slug,
    content: story.content ?? '',
    thumbnail: story.thumbnail ?? '',
    status: story.status,
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

  const storyQuery = useStory(id)
  const categoriesQuery = useCategories(canReadCategories)
  const updateStory = useUpdateStory()
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
    if (!id) return
    updateStory.mutate(
      { id, payload },
      {
        onSuccess: () => {
          toastSuccess(t('story:toast.updated'))
          navigate('/stories')
        },
        onError: (err: unknown) => {
          // 422/409 mengalir ke form via submissionError → setError per-field; tetap di halaman.
          if (isValidationError(err) || isConflictError(err)) return
          toastError(getApiErrorMessage(err, t('story:toast.updateFailed')))
        },
      },
    )
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
          isPending={updateStory.isPending}
          submissionError={updateStory.error}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/stories')}
          categories={categoriesQuery.data?.items ?? []}
          isLoadingCategories={categoriesQuery.isPending}
          canReadCategories={canReadCategories}
          canCreateCategory={canCreateCategory}
          onCreateCategory={handleCreateCategory}
          onUploadImage={uploadImage.mutateAsync}
          onUploadError={handleUploadError}
        />
      ) : null}
    </div>
  )
}
