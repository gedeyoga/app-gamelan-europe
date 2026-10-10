import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { SubscriptionRequestStatus } from '../types'

const STATUS_VARIANT: Record<SubscriptionRequestStatus, 'default' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
}

export interface SubscriptionRequestStatusBadgeProps {
  status: SubscriptionRequestStatus
  className?: string
}

// Badge status request — selalu pakai label (bukan warna saja).
export function SubscriptionRequestStatusBadge({
  status,
  className,
}: SubscriptionRequestStatusBadgeProps) {
  const { t } = useTranslation('subscriptionRequest')
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn(className)}>
      {t(`statusOptions.${status}`, { defaultValue: status })}
    </Badge>
  )
}
