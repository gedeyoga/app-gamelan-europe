import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { ArchiveDetail } from '@/features/archive/components/archive-detail'
import { useArchive } from '@/features/archive/hooks/use-archive'
import { isNotFoundError } from '@/lib/api-client'

export function ArchiveDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const { can } = useAuthPermissions()

  const canRead = can('archive:read')
  const archiveQuery = useArchive(id, canRead)

  function handleBack() {
    // Entry pertama (tab baru) tidak punya riwayat internal → fallback ke daftar archive.
    if (location.key !== 'default') {
      navigate(-1)
      return
    }
    navigate('/archives')
  }

  const backButton = (
    <Button type="button" variant="outline" onClick={handleBack}>
      <ArrowLeft className="size-4" data-icon="inline-start" />
      {t('archive:detail.back')}
    </Button>
  )

  if (!canRead) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="size-6 text-destructive" />
        <p className="text-sm font-medium">{t('archive:errors.forbidden')}</p>
        {backButton}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {backButton}

      {archiveQuery.isPending ? (
        <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[18rem_1fr] lg:gap-8">
          <Skeleton className="h-9 w-2/3 lg:col-start-2 lg:row-start-1" />
          <div className="flex flex-col gap-4 lg:sticky lg:top-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start">
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      ) : archiveQuery.isError ? (
        isForbiddenError(archiveQuery.error) ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('archive:errors.forbidden')}</p>
          </div>
        ) : isNotFoundError(archiveQuery.error) ? (
          <p className="text-center text-sm text-muted-foreground">{t('archive:detail.notFound')}</p>
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
        <ArchiveDetail archive={archiveQuery.data} />
      ) : (
        <p className="text-center text-sm text-muted-foreground">{t('archive:detail.notFound')}</p>
      )}
    </div>
  )
}
