import { useEffect, useState } from 'react'
import { Receipt, RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { MyBillingTable } from '@/features/billing/components/my-billing-table'
import { useMyBillings } from '@/features/billing/hooks/use-my-billings'
import { AvailablePlansGrid } from '@/features/subscription/components/available-plans-grid'
import { CurrentSubscriptionCard } from '@/features/subscription/components/current-subscription-card'
import { useAvailableSubscriptions } from '@/features/subscription/hooks/use-available-subscriptions'
import { useMySubscription } from '@/features/subscription/hooks/use-my-subscription'

const PAGE_LIMIT = 10
const PLAN_LIMIT = 12

function SubscriptionSkeleton() {
  return <Skeleton className="h-36 w-full" />
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

export function MyBillingsPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const subscriptionQuery = useMySubscription()
  const mySubscription = subscriptionQuery.data
  const billingsQuery = useMyBillings({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
  })
  // Katalog plan hanya di-fetch saat user tidak punya subscription aktif.
  const plansQuery = useAvailableSubscriptions({
    page: 1,
    limit: PLAN_LIMIT,
    enabled: subscriptionQuery.isSuccess && subscriptionQuery.data === null,
  })

  const listTotal = billingsQuery.data?.total ?? 0
  const billingsForbidden = isForbiddenError(billingsQuery.error)
  const subscriptionForbidden = isForbiddenError(subscriptionQuery.error)
  const plansForbidden = isForbiddenError(plansQuery.error)

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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('myBilling:title')}</h1>
        <p className="text-sm text-muted-foreground">{t('myBilling:subtitle')}</p>
      </div>

      <section aria-labelledby="my-subscription-heading" className="flex flex-col gap-3">
        <h2 id="my-subscription-heading" className="text-lg font-medium">
          {t('myBilling:currentSubscription.title')}
        </h2>

        {subscriptionQuery.isPending ? (
          <SubscriptionSkeleton />
        ) : subscriptionQuery.isError ? (
          subscriptionForbidden ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
              <ShieldAlert className="size-6 text-destructive" />
              <p className="text-sm font-medium">{t('myBilling:errors.forbidden')}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
              {t('myBilling:errors.loadSubscription')}
              <Button
                variant="link"
                size="sm"
                className="ml-2 h-auto p-0"
                onClick={() => void subscriptionQuery.refetch()}
              >
                <RefreshCw className="size-3.5" data-icon="inline-start" />
                {t('common:actions.retry')}
              </Button>
            </div>
          )
        ) : mySubscription ? (
          <CurrentSubscriptionCard subscription={mySubscription} />
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
              <Receipt className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">{t('myBilling:noSubscription.title')}</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {t('myBilling:noSubscription.description')}
              </p>
            </div>

            <h2 className="mt-2 text-lg font-medium">{t('myBilling:availablePlans.title')}</h2>
            {plansQuery.isPending ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 w-full" />
                ))}
              </div>
            ) : plansQuery.isError ? (
              plansForbidden ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
                  <ShieldAlert className="size-6 text-destructive" />
                  <p className="text-sm font-medium">{t('myBilling:errors.forbidden')}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                  {t('myBilling:errors.loadPlans')}
                  <Button
                    variant="link"
                    size="sm"
                    className="ml-2 h-auto p-0"
                    onClick={() => void plansQuery.refetch()}
                  >
                    <RefreshCw className="size-3.5" data-icon="inline-start" />
                    {t('common:actions.retry')}
                  </Button>
                </div>
              )
            ) : (
              <AvailablePlansGrid items={plansQuery.data?.items ?? []} />
            )}
          </>
        )}
      </section>

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
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
              <ShieldAlert className="size-6 text-destructive" />
              <p className="text-sm font-medium">{t('myBilling:errors.forbidden')}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
              {t('myBilling:errors.loadData')}
              <Button
                variant="link"
                size="sm"
                className="ml-2 h-auto p-0"
                onClick={() => void billingsQuery.refetch()}
              >
                <RefreshCw className="size-3.5" data-icon="inline-start" />
                {t('common:actions.retry')}
              </Button>
            </div>
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
              total={billingsQuery.data?.total ?? 0}
              entityName={t('myBilling:billings.title')}
              isPending={billingsQuery.isPending}
              onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setPage((prev) => prev + 1)}
            />
          </>
        )}
      </section>
    </div>
  )
}
