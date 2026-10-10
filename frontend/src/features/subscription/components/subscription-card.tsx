import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/datetime'

import { formatPriceInput } from '../lib/price'
import type { Subscription } from '../types'

export interface SubscriptionCardProps {
  subscription: Subscription
  onEdit: (subscription: Subscription) => void
  onDelete: (subscription: Subscription) => void
  /** Gate `subscription:update` — aksi Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `subscription:delete` — aksi Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
}

export function SubscriptionCard({
  subscription,
  onEdit,
  onDelete,
  canUpdate = true,
  canDelete = true,
}: SubscriptionCardProps) {
  const { t } = useTranslation()
  const showActions = canUpdate || canDelete

  return (
    <Card className="rounded-xl transition-colors hover:border-foreground/20 active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0">
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-2">
          <CardTitle className="truncate" title={subscription.name}>
            {subscription.name}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {t(`subscription:subscriptionTypeOptions.${subscription.subscriptionType}`, {
                defaultValue: subscription.subscriptionType,
              })}
            </Badge>
            <Badge variant={subscription.status === 'ACTIVE' ? 'secondary' : 'outline'}>
              {t(`subscription:statusOptions.${subscription.status}`, {
                defaultValue: subscription.status,
              })}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          <span className="mr-1 text-sm font-normal text-muted-foreground">
            {subscription.currency}
          </span>
          {formatPriceInput(subscription.price.toFixed(2))}
        </p>
        <dl className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t('subscription:fields.durationInDays')}</dt>
            <dd className="tabular-nums">
              {t('subscription:card.durationValue', { count: subscription.durationInDays })}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t('subscription:fields.subscriberCount')}</dt>
            <dd className="tabular-nums">
              {t('subscription:card.subscriberValue', { count: subscription.subscriberCount })}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t('subscription:fields.createdAt')}</dt>
            <dd className="truncate">{formatDateTime(subscription.createdAt)}</dd>
          </div>
        </dl>
        {showActions && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {canUpdate && (
              <Button variant="outline" onClick={() => onEdit(subscription)}>
                <Pencil className="size-4" data-icon="inline-start" />
                {t('subscription:card.edit')}
              </Button>
            )}
            {canDelete && (
              <Button variant="destructive" onClick={() => onDelete(subscription)}>
                <Trash2 className="size-4" data-icon="inline-start" />
                {t('subscription:card.delete')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
