import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { EventDetail } from '@/features/event/components/event-detail'
import { useEvent } from '@/features/event/hooks/use-event'
import { isNotFoundError } from '@/lib/api-client'

export function EventDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const { can } = useAuthPermissions()

  const canRead = can('event:read')
  const eventQuery = useEvent(id, canRead)

  function handleBack() {
    // Entry pertama (tab baru) tidak punya riwayat internal → fallback ke daftar event.
    if (location.key !== 'default') {
      navigate(-1)
      return
    }
    navigate('/events')
  }

  if (!canRead) {
    return (
      <div className="flex min-h-svh flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('event:errors.forbidden')}</p>
        <Button variant="outline" onClick={() => navigate('/events')}>
          <ArrowLeft className="size-4" data-icon="inline-start" />
          {t('event:detail.back')}
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
      aria-label={t('event:detail.back')}
      title={t('event:detail.back')}
      className="absolute left-4 top-4 z-20 rounded-full border bg-background/70 shadow-sm backdrop-blur"
    >
      <ArrowLeft className="size-4" />
    </Button>
  )

  if (!id) {
    return (
      <div className="relative min-h-svh bg-background">
        {backButton}
        <p className="mx-auto w-full max-w-5xl px-4 pt-20 text-center text-sm text-muted-foreground">
          {t('event:detail.notFound')}
        </p>
      </div>
    )
  }

  return (
    <div className="relative min-h-svh bg-background">
      {backButton}

      {eventQuery.isPending ? (
        <div className="flex flex-col">
          <Skeleton className="aspect-[21/9] min-h-64 w-full" />
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 lg:grid-cols-3">
            <div className="flex flex-col gap-3 lg:col-span-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-64 w-full lg:col-span-1" />
          </div>
        </div>
      ) : eventQuery.isError ? (
        isForbiddenError(eventQuery.error) ? (
          <div className="mx-auto mt-20 flex w-full max-w-5xl flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('event:errors.forbidden')}</p>
          </div>
        ) : isNotFoundError(eventQuery.error) ? (
          <p className="mx-auto w-full max-w-5xl px-4 pt-20 text-center text-sm text-muted-foreground">
            {t('event:detail.notFound')}
          </p>
        ) : (
          <div className="mx-auto mt-20 w-full max-w-5xl rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('event:errors.loadDetail')}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={() => void eventQuery.refetch()}
            >
              <RefreshCw className="size-3.5" data-icon="inline-start" />
              {t('common:actions.retry')}
            </Button>
          </div>
        )
      ) : eventQuery.data ? (
        <EventDetail event={eventQuery.data} />
      ) : (
        <p className="mx-auto w-full max-w-5xl px-4 pt-20 text-center text-sm text-muted-foreground">
          {t('event:detail.notFound')}
        </p>
      )}
    </div>
  )
}
