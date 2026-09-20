import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((plan) => (
        <Card key={plan.id}>
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.slug}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">
                {t('myBilling:availablePlans.type')}
              </p>
              <p>
                {t(`subscription:subscriptionTypeOptions.${plan.subscriptionType}`, {
                  defaultValue: plan.subscriptionType,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('myBilling:availablePlans.currency')}
              </p>
              <p>{plan.currency}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
