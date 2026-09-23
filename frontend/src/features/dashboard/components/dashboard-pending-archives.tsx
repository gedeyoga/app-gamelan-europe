import { Check, Eye, ImageOff, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import type { DashboardPendingArchiveItem } from '../types'

export interface DashboardPendingArchivesProps {
  items: DashboardPendingArchiveItem[]
  isPending: boolean
  isError: boolean
  canApprove: boolean
  canReject: boolean
  /** Query list sedang refetch (mis. setelah mutation); tombol aksi ditahan. */
  isRefreshing?: boolean
  onViewDetail: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  /** Id arsip yang sedang diproses; tombol aksi baris tsb dinonaktifkan. */
  busyId?: string
  className?: string
}

export function DashboardPendingArchives({
  items,
  isPending,
  isError,
  canApprove,
  canReject,
  isRefreshing = false,
  onViewDetail,
  onApprove,
  onReject,
  busyId,
  className,
}: DashboardPendingArchivesProps) {
  const { t } = useTranslation('dashboard')

  if (isPending) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (isError || items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {isError ? t('section.pendingArchives.error') : t('section.pendingArchives.empty')}
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {items.map((item) => {
        const busy = busyId === item.id
        const actionsDisabled = busy || isRefreshing
        return (
          <Card key={item.id} size="sm">
            <CardContent className="flex items-center gap-3">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt=""
                  className="size-12 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ImageOff className="size-5" aria-hidden="true" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{item.name}</p>
                  <Badge variant="secondary">{t('archive:statusOptions.REQUEST')}</Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {item.creatorName ?? t('pending.unknown')}
                </p>
                {item.description ? (
                  <p className="truncate text-sm text-muted-foreground">{item.description}</p>
                ) : item.categories.length > 0 ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {item.categories.join(' · ')}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => onViewDetail(item.id)}>
                  <Eye className="size-4" data-icon="inline-start" />
                  {t('pending.viewDetail')}
                </Button>
                {canApprove && (
                  <Button
                    size="sm"
                    disabled={actionsDisabled}
                    aria-busy={busy}
                    onClick={() => onApprove(item.id)}
                  >
                    <Check className="size-4" data-icon="inline-start" />
                    {t('pending.approve')}
                  </Button>
                )}
                {canReject && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionsDisabled}
                    aria-busy={busy}
                    onClick={() => onReject(item.id)}
                  >
                    <X className="size-4" data-icon="inline-start" />
                    {t('pending.reject')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
