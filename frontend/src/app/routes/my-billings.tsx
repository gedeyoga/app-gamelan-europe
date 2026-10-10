// Reading this as: authenticated account/billing page for Gamelan Europe members, calm information-dense
// dashboard, leaning on existing shadcn/ui + Geist + neutral oklch tokens with a single restrained status accent.
import { useEffect, useState } from 'react'
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { MemberBadge } from '@/components/shared/member-gate'
import { SearchBar } from '@/components/shared/search-bar'
import { StatCard } from '@/components/shared/stat-card'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDate } from '@/lib/datetime'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useMembership } from '@/features/auth/hooks/use-membership'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { MyBillingTable } from '@/features/billing/components/my-billing-table'
import { formatMoney } from '@/features/billing/lib/money'
import type { Billing } from '@/features/billing/types'
import { useMyBillings } from '@/features/billing/hooks/use-my-billings'
import { AvailablePlansGrid } from '@/features/subscription/components/available-plans-grid'
import { MembershipStatusPanel } from '@/features/subscription/components/membership-status-panel'
import { useAvailableSubscriptions } from '@/features/subscription/hooks/use-available-subscriptions'
import { useMySubscription } from '@/features/subscription/hooks/use-my-subscription'
import { MySubscriptionRequestsPanel } from '@/features/subscription-request/components/my-subscription-requests-panel'
import { RequestSubscriptionDialog } from '@/features/subscription-request/components/request-subscription-dialog'
import { useCreateMySubscriptionRequest } from '@/features/subscription-request/hooks/use-create-my-subscription-request'
import { useMySubscriptionRequests } from '@/features/subscription-request/hooks/use-my-subscription-requests'
import type {
  CreateMySubscriptionRequestInput,
  SubscriptionRequestPlanOption,
} from '@/features/subscription-request/types'

const PAGE_LIMIT = 10
const PLAN_LIMIT = 12
// ponytail: katalog paket untuk dialog request dibatasi 100 (batas backend).
const REQUEST_PLAN_LIMIT = 100
// ponytail: daftar request milik user dibatasi 100 baris (batas backend).
const REQUEST_LIMIT = 100
// ponytail: stats dihitung dari maksimum 100 billing terbaru (batas backend). Pindah ke endpoint
// agregat bila user bisa melewati 100 baris.
const SUMMARY_LIMIT = 100

function StatusPanelSkeleton() {
  return (
    <Card className="rounded-xl">
      <CardContent className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="gap-0">
          <CardContent className="flex items-center gap-4">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="flex w-full flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BillingsTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

function ForbiddenState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
      <ShieldAlert className="size-6 text-destructive" />
      <p className="text-sm font-medium">{t('myBilling:errors.forbidden')}</p>
    </div>
  )
}

function LoadErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
      {message}
      <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={onRetry}>
        <RefreshCw className="size-3.5" data-icon="inline-start" />
        {t('common:actions.retry')}
      </Button>
    </div>
  )
}

export function MyBillingsPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 400)
  const isMember = useMembership()
  const subscriptionQuery = useMySubscription()
  const mySubscription = subscriptionQuery.data
  const hasMembership = mySubscription !== null || isMember
  const billingsQuery = useMyBillings({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
  })
  // Ringkasan lintas-halaman untuk statistik + callout (terpisah dari tabel yang dipaginate/difilter).
  const summaryQuery = useMyBillings({ page: 1, limit: SUMMARY_LIMIT })
  // Katalog plan hanya di-fetch saat user tidak punya subscription aktif dan bukan member.
  const plansQuery = useAvailableSubscriptions({
    page: 1,
    limit: PLAN_LIMIT,
    enabled: !isMember && subscriptionQuery.isSuccess && subscriptionQuery.data === null,
  })
  const myRequestsQuery = useMySubscriptionRequests({ page: 1, limit: REQUEST_LIMIT })
  // Katalog paket untuk dialog request — hanya di-fetch saat dialog dibuka.
  const requestPlansQuery = useAvailableSubscriptions({
    page: 1,
    limit: REQUEST_PLAN_LIMIT,
    enabled: requestOpen,
  })
  const createRequest = useCreateMySubscriptionRequest()

  const requestPlans: SubscriptionRequestPlanOption[] = (requestPlansQuery.data?.items ?? []).map(
    (plan) => ({
      id: plan.id,
      name: plan.name,
      subscriptionType: plan.subscriptionType,
      currency: plan.currency,
      price: plan.price,
      durationInDays: plan.durationInDays,
    }),
  )

  const listTotal = billingsQuery.data?.total ?? 0
  const billingsForbidden = isForbiddenError(billingsQuery.error)
  const subscriptionForbidden = isForbiddenError(subscriptionQuery.error)
  const plansForbidden = isForbiddenError(plansQuery.error)

  // Derivasi statistik dari ringkasan (hanya nilai yang benar-benar dikirim API).
  const summaryItems = summaryQuery.data?.items ?? []
  const paidBillings = summaryItems.filter((billing) => billing.status === 'PAID')
  const pendingBillings = summaryItems.filter((billing) => billing.status === 'PENDING')
  // Ringkasan dihitung per mata uang: jumlah lintas-mata-uang tidak bermakna.
  const totalsByCurrency = paidBillings.reduce<Map<string, number>>((map, billing) => {
    map.set(billing.currency, (map.get(billing.currency) ?? 0) + billing.total)
    return map
  }, new Map())
  // Nilai utama = total mata uang paket aktif; fallback ke mata uang pertama yang muncul.
  const primaryCurrency = mySubscription?.currency ?? totalsByCurrency.keys().next().value ?? ''
  const totalPaid = totalsByCurrency.get(primaryCurrency) ?? 0
  const otherCurrencyTotals = [...totalsByCurrency.entries()].filter(
    ([code, amount]) => code !== primaryCurrency && amount !== 0,
  )
  // Baris meringkas 100 terbaru saja → tandai bila API masih punya data lebih banyak.
  const isTruncated = summaryItems.length < (summaryQuery.data?.total ?? 0)
  const lastPaymentAt = paidBillings.reduce<string | null>(
    (latest, billing) =>
      billing.paidAt && (!latest || billing.paidAt > latest) ? billing.paidAt : latest,
    null,
  )
  const pendingBilling = pendingBillings[0] ?? null
  const validityBilling = paidBillings.reduce<Billing | null>((latest, billing) => {
    if (!billing.expiryDate) return latest
    if (!latest?.expiryDate) return billing
    return billing.expiryDate > latest.expiryDate ? billing : latest
  }, null)

  // Clamp pagination boundary — setState di effect disengaja (bukan sync external system).
  useEffect(() => {
    if (listTotal > 0 && page > 1 && (page - 1) * PAGE_LIMIT >= listTotal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(Math.max(1, Math.ceil(listTotal / PAGE_LIMIT)))
    }
  }, [listTotal, page])

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleSort(field: string) {
    const next = nextSort(sortBy, sortOrder, field)
    setSortBy(next.sortBy)
    setSortOrder(next.sortOrder)
    setPage(1)
  }

  function handleResetSearch() {
    setSearch('')
    setPage(1)
  }

  function handleCreateRequest(payload: CreateMySubscriptionRequestInput) {
    createRequest.mutate(payload, {
      onSuccess: () => {
        setRequestOpen(false)
        toastSuccess(t('subscriptionRequest:toast.created'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return // 422 → per-field di dialog
        toastError(
          getApiErrorMessage(err, t('subscriptionRequest:toast.createFailed')),
        )
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{t('myBilling:title')}</h1>
          {isMember && <MemberBadge />}
        </div>
        <p className="text-sm text-muted-foreground">{t('myBilling:subtitle')}</p>
      </header>

      <section aria-labelledby="my-membership-heading" className="flex flex-col gap-3">
        <h2 id="my-membership-heading" className="text-lg font-medium">
          {hasMembership
            ? t('myBilling:currentSubscription.title')
            : t('myBilling:availablePlans.title')}
        </h2>

        {subscriptionQuery.isPending ? (
          <StatusPanelSkeleton />
        ) : subscriptionQuery.isError ? (
          subscriptionForbidden ? (
            <ForbiddenState />
          ) : (
            <LoadErrorBanner
              message={t('myBilling:errors.loadSubscription')}
              onRetry={() => void subscriptionQuery.refetch()}
            />
          )
        ) : mySubscription ? (
          <MembershipStatusPanel
            subscription={mySubscription}
            startDate={validityBilling?.startDate ?? null}
            expiryDate={validityBilling?.expiryDate ?? null}
          />
        ) : isMember ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-8 text-center">
            <CheckCircle2 className="size-6 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">{t('myBilling:membership.active')}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {t('myBilling:membership.activeDescription')}
            </p>
          </div>
        ) : plansQuery.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))}
          </div>
        ) : plansQuery.isError ? (
          plansForbidden ? (
            <ForbiddenState />
          ) : (
            <LoadErrorBanner
              message={t('myBilling:errors.loadPlans')}
              onRetry={() => void plansQuery.refetch()}
            />
          )
        ) : (
          <AvailablePlansGrid items={plansQuery.data?.items ?? []} />
        )}
      </section>

      <section aria-label={t('myBilling:stats.title')} className="flex flex-col gap-3">
        {summaryQuery.isError ? (
          <LoadErrorBanner
            message={t('myBilling:errors.loadData')}
            onRetry={() => void summaryQuery.refetch()}
          />
        ) : summaryQuery.isPending ? (
          <StatsSkeleton />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={Wallet}
                label={t('myBilling:stats.totalPaid')}
                value={formatMoney(totalPaid, primaryCurrency)}
                hint={
                  paidBillings.length > 0
                    ? t('myBilling:stats.paidCount', { count: paidBillings.length })
                    : t('myBilling:stats.noPayments')
                }
              />
              <StatCard
                icon={CalendarCheck}
                label={t('myBilling:stats.lastPayment')}
                value={lastPaymentAt ? formatDate(lastPaymentAt) : '—'}
              />
              <StatCard
                icon={Receipt}
                label={t('myBilling:stats.paymentCount')}
                value={listTotal}
              />
              <StatCard
                icon={Clock}
                label={t('myBilling:stats.pending')}
                value={pendingBillings.length}
              />
            </div>
            {otherCurrencyTotals.length > 0 && (
              <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground tabular-nums">
                {otherCurrencyTotals.map(([code, amount]) => (
                  <span key={code}>
                    {t('myBilling:stats.otherCurrencyTotal', {
                      amount: formatMoney(amount, code),
                    })}
                  </span>
                ))}
              </p>
            )}
            {isTruncated && (
              <p className="text-xs text-muted-foreground">
                {t('myBilling:stats.truncated', { count: summaryItems.length })}
              </p>
            )}
          </div>
        )}
      </section>

      {pendingBilling && (
        <section aria-label={t('myBilling:stats.pending')}>
          <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{t('myBilling:stats.pending')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('myBilling:pendingCallout.message', {
                    code: pendingBilling.code,
                    amount: formatMoney(pendingBilling.total, pendingBilling.currency),
                  })}
                </p>
              </div>
            </div>
            {pendingBilling.paymentProofUrl ? (
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <a
                  href={pendingBilling.paymentProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  {t('billing:history.viewProof')}
                </a>
                <span className="text-xs text-muted-foreground">
                  {t('myBilling:pendingCallout.proofAttached')}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {t('myBilling:pendingCallout.noProof')}
              </span>
            )}
          </div>
        </section>
      )}

      <MySubscriptionRequestsPanel
        items={myRequestsQuery.data?.items ?? []}
        isPending={myRequestsQuery.isPending}
        isError={myRequestsQuery.isError}
        onRequest={() => setRequestOpen(true)}
      />

      <section aria-labelledby="my-billings-heading" className="flex flex-col gap-4">
        <h2 id="my-billings-heading" className="text-lg font-medium">
          {t('myBilling:billings.title')}
        </h2>

        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('myBilling:search.placeholder')}
          ariaLabel={t('myBilling:search.ariaLabel')}
        />

        {billingsQuery.isError ? (
          billingsForbidden ? (
            <ForbiddenState />
          ) : (
            <LoadErrorBanner
              message={t('myBilling:errors.loadData')}
              onRetry={() => void billingsQuery.refetch()}
            />
          )
        ) : (
          <>
            {billingsQuery.isPending ? (
              <BillingsTableSkeleton />
            ) : (
              <MyBillingTable
                items={billingsQuery.data?.items ?? []}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                searchTerm={debouncedSearch}
                onResetSearch={handleResetSearch}
              />
            )}

            <DataTablePagination
              page={page}
              limit={PAGE_LIMIT}
              total={listTotal}
              entityName={t('myBilling:billings.title')}
              isPending={billingsQuery.isPending}
              onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setPage((prev) => prev + 1)}
            />
          </>
        )}
      </section>

      <RequestSubscriptionDialog
        open={requestOpen}
        plans={requestPlans}
        isLoading={requestPlansQuery.isPending}
        isError={requestPlansQuery.isError}
        isSubmitting={createRequest.isPending}
        submissionError={createRequest.error}
        onConfirm={handleCreateRequest}
        onOpenChange={setRequestOpen}
      />
    </div>
  )
}
