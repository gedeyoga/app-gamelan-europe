import { Plus, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

import { SubscriptionRequestStatusBadge } from './subscription-request-status-badge'
import type { SubscriptionRequest } from '../types'

export interface MySubscriptionRequestsPanelProps {
  items: SubscriptionRequest[]
  isPending: boolean
  isError: boolean
  /** Gate tombol "Ajukan Langganan" — default `true`. */
  canRequest?: boolean
  onRequest: () => void
  className?: string
}

// Panel request langganan milik user + tombol ajukan (self-service).
export function MySubscriptionRequestsPanel({
  items,
  isPending,
  isError,
  canRequest = true,
  onRequest,
  className,
}: MySubscriptionRequestsPanelProps) {
  const { t } = useTranslation('subscriptionRequest')
  const { t: tSubscription } = useTranslation('subscription')

  return (
    <section
      aria-labelledby="my-subscription-requests-heading"
      className={cn('flex flex-col gap-3', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="my-subscription-requests-heading" className="text-lg font-medium">
          {t('myRequests.title')}
        </h2>
        {canRequest && (
          <Button size="sm" onClick={onRequest}>
            <Plus className="size-4" data-icon="inline-start" />
            {t('myRequests.requestButton')}
          </Button>
        )}
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {t('errors.load')}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t('myRequests.empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((request) => (
            <Card key={request.id} size="sm">
              <CardContent className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium">{request.subscription.name}</span>
                  <Badge variant="outline">
                    {t(`requestTypeOptions.${request.requestType}`, {
                      defaultValue: request.requestType,
                    })}
                  </Badge>
                  <SubscriptionRequestStatusBadge status={request.status} className="ml-auto" />
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>
                    {tSubscription(
                      `subscriptionTypeOptions.${request.subscription.subscriptionType}`,
                      { defaultValue: request.subscription.subscriptionType },
                    )}
                  </span>
                  <span className="tabular-nums">{formatDateTime(request.createdAt)}</span>
                </div>
                {request.status === 'REJECTED' && request.reviewNote && (
                  <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {t('detail.reviewNote')}: {request.reviewNote}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
