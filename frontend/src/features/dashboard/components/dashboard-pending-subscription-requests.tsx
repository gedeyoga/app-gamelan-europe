import { Check, CreditCard, Eye, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

import type { DashboardPendingSubscriptionRequestItem } from '../types'

export interface DashboardPendingSubscriptionRequestsProps {
  items: DashboardPendingSubscriptionRequestItem[]
  isPending: boolean
  isError: boolean
  canApprove: boolean
  canReject: boolean
  /** Query list sedang refetch (mis. setelah mutation); tombol aksi ditahan. */
  isRefreshing?: boolean
  onView: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  /** Id request yang sedang diproses; aksi baris tsb dinonaktifkan. */
  busyId?: string
  className?: string
}

// Daftar ringkas request langganan menunggu review (dashboard admin).
export function DashboardPendingSubscriptionRequests({
  items,
  isPending,
  isError,
  canApprove,
  canReject,
  isRefreshing = false,
  onView,
  onApprove,
  onReject,
  busyId,
  className,
}: DashboardPendingSubscriptionRequestsProps) {
  const { t } = useTranslation('dashboard')
  const { t: tRequest } = useTranslation('subscriptionRequest')

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
        {isError
          ? t('section.pendingSubscriptionRequests.error')
          : t('section.pendingSubscriptionRequests.empty')}
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
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <CreditCard className="size-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{item.fullName}</p>
                  <Badge variant="outline" className="shrink-0">
                    {tRequest(`requestTypeOptions.${item.requestType}`, {
                      defaultValue: item.requestType,
                    })}
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">{item.email}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {item.planName} · {formatDateTime(item.createdAt)}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionsDisabled}
                  aria-busy={busy}
                  onClick={() => onView(item.id)}
                >
                  <Eye className="size-4" data-icon="inline-start" />
                  {tRequest('actions.view')}
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
