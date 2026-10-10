import { AlertTriangle, CheckCircle2, CreditCard, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/datetime'

import { formatPriceInput } from '../lib/price'
import type { Subscription } from '../types'

const DAY_MS = 86_400_000
const EXPIRING_SOON_DAYS = 14

type WindowState = 'active' | 'expiring' | 'expired' | 'unknown'

interface ValidityWindow {
  state: WindowState
  daysRemaining: number
  /** Persentase masa berlaku terpakai (0–100). */
  progress: number
  hasMeter: boolean
}

// Hitung state meter dari startDate/expiryDate. `null`/invalid → state `unknown`, tanpa meter.
// ponytail: bila startDate hilang, awal diturunkan dari `expiryDate - durationInDays`; tambah field
// periode eksplisit di API bila nanti perlu akurasi lebih.
function resolveWindow(
  startDate: string | null,
  expiryDate: string | null,
  durationInDays: number,
): ValidityWindow {
  const expiry = expiryDate ? new Date(expiryDate) : null
  if (!expiry || Number.isNaN(expiry.getTime())) {
    return { state: 'unknown', daysRemaining: 0, progress: 0, hasMeter: false }
  }

  const now = Date.now()
  const isPast = expiry.getTime() < now
  const daysRemaining = Math.ceil((expiry.getTime() - now) / DAY_MS)
  const state: WindowState =
    isPast ? 'expired' : daysRemaining <= EXPIRING_SOON_DAYS ? 'expiring' : 'active'

  const parsedStart = startDate ? new Date(startDate) : null
  const startMs =
    parsedStart && !Number.isNaN(parsedStart.getTime())
      ? parsedStart.getTime()
      : durationInDays > 0
        ? expiry.getTime() - durationInDays * DAY_MS
        : Number.NaN

  const total = expiry.getTime() - startMs
  const progress = Number.isFinite(total) && total > 0
    ? Math.min(100, Math.max(0, Math.round(((now - startMs) / total) * 100)))
    : 0

  return { state, daysRemaining, progress, hasMeter: Number.isFinite(total) && total > 0 }
}

const METER_TONE: Record<Exclude<WindowState, 'unknown'>, string> = {
  active: 'bg-primary',
  expiring: 'bg-amber-500',
  expired: 'bg-destructive',
}

export interface MembershipStatusPanelProps {
  subscription: Subscription
  /** Awal masa berlaku billing PAID terakhir; `null` bila tak tersedia. */
  startDate: string | null
  /** Akhir masa berlaku billing PAID terakhir; `null` bila tak tersedia. */
  expiryDate: string | null
}

// Panel status keanggotaan — hero halaman. Presentational: seluruh data via props.
export function MembershipStatusPanel({
  subscription,
  startDate,
  expiryDate,
}: MembershipStatusPanelProps) {
  const { t } = useTranslation()
  const progressId = `membership-progress-${subscription.id}`
  const window = resolveWindow(startDate, expiryDate, subscription.durationInDays)

  const stateTone =
    window.state === 'expired'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : window.state === 'expiring'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-primary/40 bg-primary/5 text-primary'

  const StateIcon = window.state === 'expired' ? XCircle : window.state === 'expiring' ? AlertTriangle : CheckCircle2

  return (
    <Card className="rounded-xl">
      <CardContent className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Kiri: paket aktif + harga menonjol */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <CreditCard className="size-3" aria-hidden="true" />
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

          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">{t('myBilling:statusPanel.plan')}</p>
            <p className="truncate text-xl font-semibold" title={subscription.name}>
              {subscription.name}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">{t('myBilling:statusPanel.price')}</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              <span className="mr-1 text-sm font-normal text-muted-foreground">
                {subscription.currency}
              </span>
              {formatPriceInput(subscription.price.toFixed(2))}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('subscription:card.durationValue', { count: subscription.durationInDays })}
            </p>
          </div>
        </div>

        {/* Kanan: masa berlaku + meter sisa hari */}
        <div className="flex flex-col gap-4 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t('myBilling:statusPanel.validity')}</span>
            {window.state !== 'unknown' && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                  stateTone,
                )}
              >
                <StateIcon className="size-3" aria-hidden="true" />
                {window.state === 'expired'
                  ? t('myBilling:statusPanel.expired')
                  : window.state === 'expiring'
                    ? t('myBilling:statusPanel.expiringSoon')
                    : t('subscription:statusOptions.ACTIVE')}
              </span>
            )}
          </div>

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t('myBilling:statusPanel.startLabel')}</dt>
              <dd className="tabular-nums">{formatDate(startDate)}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t('myBilling:statusPanel.expiryLabel')}</dt>
              <dd className="tabular-nums">{formatDate(expiryDate)}</dd>
            </div>
          </dl>

          {window.state === 'unknown' ? (
            <p className="text-xs text-muted-foreground">{t('myBilling:statusPanel.noValidity')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Meter hanya bila ada basis (startDate atau durationInDays) — tanpa basis, tak ada bar 0%. */}
              {window.hasMeter && (
                <div
                  id={progressId}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={window.progress}
                  aria-label={t('myBilling:statusPanel.progressLabel')}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none',
                      METER_TONE[window.state],
                    )}
                    style={{ width: `${window.progress}%` }}
                  />
                </div>
              )}

              <p className="text-sm">
                {window.state === 'expired' ? (
                  <span className="font-medium text-destructive">
                    {t('myBilling:statusPanel.expired')}
                  </span>
                ) : (
                  <>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        window.state === 'expiring' && 'text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {window.daysRemaining}
                    </span>{' '}
                    <span
                      className={cn(
                        'text-muted-foreground',
                        window.state === 'expiring' && 'text-amber-700 dark:text-amber-300',
                      )}
                    >
                      {t('myBilling:statusPanel.daysLeft')}
                    </span>
                  </>
                )}
              </p>

              {window.state === 'expiring' && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {t('myBilling:statusPanel.expiringSoonNote')}
                </p>
              )}
              {window.state === 'expired' && (
                <p className="text-xs text-destructive">{t('myBilling:statusPanel.expiredNote')}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
