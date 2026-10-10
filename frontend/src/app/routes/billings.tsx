import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { BillingHistoryDialog } from '@/features/billing/components/billing-history-dialog'
import { BillingMemberTable } from '@/features/billing/components/billing-member-table'
import { CancelBillingDialog } from '@/features/billing/components/cancel-billing-dialog'
import {
  SubscribeBillingDialog,
  type SubscribeBillingMode,
} from '@/features/billing/components/subscribe-billing-dialog'
import { useBillingMembers } from '@/features/billing/hooks/use-billing-members'
import { useCancelBilling } from '@/features/billing/hooks/use-cancel-billing'
import { useSubscribeBilling } from '@/features/billing/hooks/use-subscribe-billing'
import { useUploadPaymentProof } from '@/features/billing/hooks/use-upload-payment-proof'
import { useUserBillings } from '@/features/billing/hooks/use-user-billings'
import type {
  BillingSubscriptionOption,
  MemberSubscription,
  PaymentProof,
} from '@/features/billing/types'
import { useSubscriptions } from '@/features/subscription/hooks/use-subscriptions'

const PAGE_LIMIT = 10
const OPTION_LIMIT = 100
const HISTORY_LIMIT = 5

function MembersTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function BillingsPage() {
  const { t } = useTranslation()
  const { can } = useAuthPermissions()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [subscribeTarget, setSubscribeTarget] = useState<MemberSubscription | null>(null)
  const [subscribeMode, setSubscribeMode] = useState<SubscribeBillingMode>('new')
  const [cancelTarget, setCancelTarget] = useState<MemberSubscription | null>(null)
  const [historyTarget, setHistoryTarget] = useState<MemberSubscription | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [paymentProof, setPaymentProof] = useState<PaymentProof | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const membersQuery = useBillingMembers({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
  })
  // Opsi paket di-fetch lazy: hanya saat dialog subscribe terbuka + sesi punya `subscription:read`.
  const subscriptionsQuery = useSubscriptions({
    page: 1,
    limit: OPTION_LIMIT,
    enabled: subscribeTarget !== null && can('subscription:read'),
  })
  const historyQuery = useUserBillings({
    userId: historyTarget?.userId ?? null,
    page: historyPage,
    limit: HISTORY_LIMIT,
  })

  const subscribeBilling = useSubscribeBilling()
  const cancelBilling = useCancelBilling()
  const uploadPaymentProof = useUploadPaymentProof()

  const subscriptionOptions: BillingSubscriptionOption[] = (
    subscriptionsQuery.data?.items ?? []
  ).map((subscription) => ({
    id: subscription.id,
    name: subscription.name,
    price: subscription.price,
    currency: subscription.currency,
    subscriptionType: subscription.subscriptionType,
    durationInDays: subscription.durationInDays,
  }))

  const listTotal = membersQuery.data?.total ?? 0
  const membersForbidden = isForbiddenError(membersQuery.error)

  // Koreksi halaman yang keluar jangkauan setelah total berubah.
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

  function openSubscribe(member: MemberSubscription, mode: SubscribeBillingMode) {
    setPaymentProof(null)
    uploadPaymentProof.reset()
    setSubscribeMode(mode)
    setSubscribeTarget(member)
  }

  function closeSubscribe() {
    setSubscribeTarget(null)
    setPaymentProof(null)
    uploadPaymentProof.reset()
  }

  function openHistory(member: MemberSubscription) {
    setHistoryPage(1)
    setHistoryTarget(member)
  }

  function handleSelectProof(file: File) {
    uploadPaymentProof.mutate(file, { onSuccess: setPaymentProof })
  }

  function handleSubscribe(subscriptionId: string) {
    if (!subscribeTarget) return
    subscribeBilling.mutate(
      {
        userId: subscribeTarget.userId,
        subscriptionId,
        ...(paymentProof
          ? { paymentProofUrl: paymentProof.url, paymentProofName: paymentProof.filename }
          : {}),
      },
      {
        onSuccess: () => {
          closeSubscribe()
          toastSuccess(t('billing:toast.subscribed'))
        },
        onError: (err: unknown) => {
          // 422 mengalir ke dialog via submissionError -> setError per-field; tanpa toast.
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('billing:toast.subscribeFailed')))
        },
      },
    )
  }

  function handleCancel() {
    if (!cancelTarget?.billingId) return
    cancelBilling.mutate(cancelTarget.billingId, {
      onSuccess: () => {
        setCancelTarget(null)
        toastSuccess(t('billing:toast.canceled'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('billing:toast.cancelFailed')))
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('billing:title')}</h1>
        <p className="text-sm text-muted-foreground">{t('billing:subtitle')}</p>
      </div>

      <SearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder={t('billing:search.placeholder')}
        ariaLabel={t('billing:search.ariaLabel')}
      />

      {membersQuery.isError ? (
        membersForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('billing:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('billing:errors.loadData')}
          </div>
        )
      ) : (
        <>
          {membersQuery.isPending ? (
            <MembersTableSkeleton />
          ) : (
            <BillingMemberTable
              items={membersQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onUpgrade={(member) => openSubscribe(member, 'upgrade')}
              onNew={(member) => openSubscribe(member, 'new')}
              onCancel={setCancelTarget}
              onHistory={openHistory}
              canCreate={can('billing:create')}
              canUpdate={can('billing:update')}
              canRead={can('billing:read')}
            />
          )}

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={membersQuery.data?.total ?? 0}
            entityName={t('billing:title')}
            isPending={membersQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {subscribeTarget && (
        <SubscribeBillingDialog
          mode={subscribeMode}
          member={subscribeTarget}
          subscriptions={subscriptionOptions}
          isLoading={subscriptionsQuery.isPending}
          isError={subscriptionsQuery.isError}
          isSubmitting={subscribeBilling.isPending}
          submissionError={subscribeBilling.error}
          paymentProof={paymentProof}
          isUploadingProof={uploadPaymentProof.isPending}
          proofError={
            uploadPaymentProof.error
              ? getApiErrorMessage(uploadPaymentProof.error, t('billing:subscribe.proofFailed'))
              : null
          }
          onSelectProof={handleSelectProof}
          onRemoveProof={() => {
            setPaymentProof(null)
            uploadPaymentProof.reset()
          }}
          onConfirm={handleSubscribe}
          onOpenChange={(open) => {
            if (!open) closeSubscribe()
          }}
        />
      )}

      {cancelTarget && (
        <CancelBillingDialog
          member={cancelTarget}
          isSubmitting={cancelBilling.isPending}
          onConfirm={handleCancel}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null)
          }}
        />
      )}

      {historyTarget && (
        <BillingHistoryDialog
          member={historyTarget}
          items={historyQuery.data?.items ?? []}
          page={historyPage}
          limit={HISTORY_LIMIT}
          total={historyQuery.data?.total ?? 0}
          isPending={historyQuery.isPending}
          isError={historyQuery.isError}
          isForbidden={isForbiddenError(historyQuery.error)}
          onPrev={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setHistoryPage((prev) => prev + 1)}
          onOpenChange={(open) => {
            if (!open) setHistoryTarget(null)
          }}
        />
      )}
    </div>
  )
}
