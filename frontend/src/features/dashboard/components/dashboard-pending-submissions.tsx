import { Building2, CalendarDays, Check, MapPin, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { ApprovalMediaCard } from './approval-media-card'
import type { ApprovalMediaCardMeta } from './approval-media-card'
import type { DashboardPendingSubmissionItem } from '../types'

export interface DashboardPendingSubmissionsProps {
  items: DashboardPendingSubmissionItem[]
  isPending: boolean
  isError: boolean
  canApprove: boolean
  canReject: boolean
  /** Query list sedang refetch (mis. setelah mutation); tombol aksi ditahan. */
  isRefreshing?: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  /** Id submission yang sedang diproses; tombol aksi baris tsb dinonaktifkan. */
  busyId?: string
  className?: string
}

export function DashboardPendingSubmissions({
  items,
  isPending,
  isError,
  canApprove,
  canReject,
  isRefreshing = false,
  onApprove,
  onReject,
  busyId,
  className,
}: DashboardPendingSubmissionsProps) {
  const { t } = useTranslation('dashboard')

  if (isPending) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="overflow-hidden p-0">
            <div className="flex flex-col sm:flex-row">
              <Skeleton className="aspect-video w-full rounded-none sm:w-48" />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="mt-auto flex justify-end gap-2 pt-3">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (isError || items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {isError ? t('section.pendingSubmissions.error') : t('section.pendingSubmissions.empty')}
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {items.map((item) => {
        const busy = busyId === item.id
        const actionsDisabled = busy || isRefreshing
        const location = [item.country, item.state].filter(Boolean).join(', ')
        const metadata: ApprovalMediaCardMeta[] = [
          { icon: Building2, value: item.organiser || t('pendingSubmission.unknown') },
          ...(location ? [{ icon: MapPin, value: location }] : []),
          ...(item.dateLabel ? [{ icon: CalendarDays, value: item.dateLabel }] : []),
        ]
        return (
          <ApprovalMediaCard
            key={item.id}
            thumbnail={item.thumbnail}
            title={item.title}
            badge={
              <Badge variant="secondary" className="shrink-0">
                {t('pendingSubmission.statusRequest')}
              </Badge>
            }
            metadata={metadata}
            actions={
              <>
                {canApprove && (
                  <Button
                    size="sm"
                    disabled={actionsDisabled}
                    aria-busy={busy}
                    onClick={() => onApprove(item.id)}
                  >
                    <Check className="size-4" data-icon="inline-start" />
                    {t('pendingSubmission.approve')}
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
                    {t('pendingSubmission.reject')}
                  </Button>
                )}
              </>
            }
          />
        )
      })}
    </div>
  )
}
