import { CreditCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { Subscription } from '../types'

export interface CurrentSubscriptionCardProps {
  subscription: Subscription
}

export function CurrentSubscriptionCard({ subscription }: CurrentSubscriptionCardProps) {
  const { t } = useTranslation()

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="size-5 text-primary" aria-hidden="true" />
          {t('myBilling:currentSubscription.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">{t('myBilling:currentSubscription.plan')}</p>
          <p className="text-base font-semibold">{subscription.name}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('myBilling:currentSubscription.type')}</p>
          <p>
            {t(`subscription:subscriptionTypeOptions.${subscription.subscriptionType}`, {
              defaultValue: subscription.subscriptionType,
            })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {t('myBilling:currentSubscription.currency')}
          </p>
          <p>{subscription.currency}</p>
        </div>
      </CardContent>
    </Card>
  )
}
