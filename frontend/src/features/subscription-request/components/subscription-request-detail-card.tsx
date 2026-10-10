import { CheckCircle2, CreditCard, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

import { SubscriptionRequestStatusBadge } from './subscription-request-status-badge'
import type { SubscriptionRequest } from '../types'

export interface SubscriptionRequestDetailCardProps {
  request: SubscriptionRequest
  className?: string
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value && value.length > 0 ? value : '—'}</dd>
    </div>
  )
}

// Kartu detail request langganan — presentational, seluruh data via props.
export function SubscriptionRequestDetailCard({
  request,
  className,
}: SubscriptionRequestDetailCardProps) {
  const { t } = useTranslation('subscriptionRequest')
  const { t: tSubscription } = useTranslation('subscription')
  const hasBilling = request.billingId !== null

  return (
    <Card className={cn('rounded-xl', className)}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">{request.fullName}</CardTitle>
          <SubscriptionRequestStatusBadge status={request.status} />
        </div>
        <p className="text-sm text-muted-foreground">{request.email}</p>
      </CardHeader>

      <CardContent className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3" aria-labelledby="sr-requester">
          <h3 id="sr-requester" className="text-sm font-medium">
            {t('detail.requester')}
          </h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('detail.organisation')} value={request.organisation} />
            <Field label={t('detail.phone')} value={request.phone} />
            <Field label={t('detail.country')} value={request.country} />
            <Field
              label={t('detail.website')}
              value={request.website}
            />
            <div className="sm:col-span-2">
              <Field label={t('detail.address')} value={request.address} />
            </div>
          </dl>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t('detail.reason')}</span>
            <p className="text-sm whitespace-pre-line">{request.reason}</p>
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="sr-plan">
          <h3 id="sr-plan" className="text-sm font-medium">
            {t('detail.plan')}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{request.subscription.name}</span>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label={t('detail.type')}
              value={t(`requestTypeOptions.${request.requestType}`, {
                defaultValue: request.requestType,
              })}
            />
            <Field
              label={t('detail.planType')}
              value={tSubscription(
                `subscriptionTypeOptions.${request.subscription.subscriptionType}`,
                { defaultValue: request.subscription.subscriptionType },
              )}
            />
            <Field
              label={t('detail.price')}
              value={`${request.subscription.price.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })} ${request.subscription.currency}`}
            />
            <Field
              label={t('detail.duration')}
              value={tSubscription('card.durationValue', {
                count: request.subscription.durationInDays,
              })}
            />
            <Field label={t('detail.createdAt')} value={formatDateTime(request.createdAt)} />
          </dl>

          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t('detail.review')}</span>
            {request.reviewedAt || request.reviewedBy || request.reviewNote ? (
              <div className="flex flex-col gap-1 text-sm">
                <span>
                  {t('detail.reviewedBy')}: {request.reviewedBy?.fullName ?? '—'}
                </span>
                <span className="text-muted-foreground">
                  {t('detail.reviewedAt')}: {formatDateTime(request.reviewedAt)}
                </span>
                {request.reviewNote && (
                  <span className="whitespace-pre-line">
                    {t('detail.reviewNote')}: {request.reviewNote}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('detail.notReviewed')}</p>
            )}
          </div>

          {hasBilling && (
            <Link
              to="/billings"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {t('detail.viewBilling')}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
