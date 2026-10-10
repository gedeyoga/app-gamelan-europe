import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CARD_GRID_CLASS } from '@/components/shared/card-grid'

import { formatPriceInput } from '../lib/price'
import type { Subscription } from '../types'

export interface AvailablePlansGridProps {
  items: Subscription[]
}

// ponytail: katalog display-only — belum ada endpoint checkout/self-enroll.
// Tambah tombol "Subscribe" di plan-card saat endpoint purchase tersedia.
export function AvailablePlansGrid({ items }: AvailablePlansGridProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t('myBilling:availablePlans.empty')}
      </p>
    )
  }

  return (
    <div className={CARD_GRID_CLASS}>
      {items.map((plan) => (
        <Card key={plan.id}>
          <CardHeader>
            <CardTitle className="truncate" title={plan.name}>
              {plan.name}
            </CardTitle>
            <CardDescription>{plan.slug}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              <span className="mr-1 text-sm font-normal text-muted-foreground">{plan.currency}</span>
              {formatPriceInput(plan.price.toFixed(2))}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  {t('myBilling:availablePlans.type')}
                </dt>
                <dd>
                  {t(`subscription:subscriptionTypeOptions.${plan.subscriptionType}`, {
                    defaultValue: plan.subscriptionType,
                  })}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  {t('myBilling:availablePlans.duration')}
                </dt>
                <dd className="tabular-nums">
                  {t('myBilling:availablePlans.durationValue', { count: plan.durationInDays })}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
