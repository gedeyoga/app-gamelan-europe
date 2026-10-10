import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MemberGate } from '@/components/shared/member-gate'
import { useMembership } from '@/features/auth/hooks/use-membership'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { StoryDetail } from '@/features/story/components/story-detail'
import { useStory } from '@/features/story/hooks/use-story'

export function StoryDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const { can, canViewPrivate } = useAuthPermissions()
  const isMember = useMembership()
  // 403 = "khusus member" HANYA bila user benar-benar terkunci; 403 lain tetap generik.
  const isMemberLocked = !isMember && !canViewPrivate

  const canRead = can('story:read')
  const storyQuery = useStory(id, canRead)

  function handleBack() {
    // Entry pertama (tab baru) tidak punya riwayat internal → fallback ke daftar story.
    if (location.key !== 'default') {
      navigate(-1)
      return
    }
    navigate('/stories')
  }

  if (!canRead) {
    return (
      <div className="flex min-h-svh flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('story:errors.forbidden')}</p>
        <Button variant="outline" onClick={() => navigate('/stories')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('story:detail.back')}
        </Button>
      </div>
    )
  }

  const backButton = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={handleBack}
      aria-label={t('story:detail.back')}
      title={t('story:detail.back')}
      className="absolute left-4 top-4 z-20 rounded-full border bg-background/70 shadow-sm backdrop-blur"
    >
      <ArrowLeft className="size-4" />
    </Button>
  )

  if (!id) {
    return (
      <div className="relative min-h-svh bg-background">
        {backButton}
        <p className="mx-auto w-full max-w-3xl px-4 pt-20 text-center text-sm text-muted-foreground">
          {t('story:detail.notFound')}
        </p>
      </div>
    )
  }

  return (
    <div className="relative min-h-svh bg-background">
      {backButton}

      {storyQuery.isPending ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-20 pb-8">
          <Skeleton className="aspect-[21/9] w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : storyQuery.isError ? (
        isForbiddenError(storyQuery.error) ? (
          isMemberLocked ? (
            <MemberGate unlocked={false} className="mx-auto mt-20 w-full max-w-3xl" />
          ) : (
            <div className="mx-auto mt-20 flex w-full max-w-3xl flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
              <ShieldAlert className="size-6 text-destructive" />
              <p className="text-sm font-medium">{t('story:errors.forbidden')}</p>
            </div>
          )
        ) : (
          <div className="mx-auto mt-20 w-full max-w-3xl rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
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
        <StoryDetail story={storyQuery.data} />
      ) : (
        <p className="mx-auto w-full max-w-3xl px-4 pt-20 text-center text-sm text-muted-foreground">
          {t('story:detail.notFound')}
        </p>
      )}
    </div>
  )
}
