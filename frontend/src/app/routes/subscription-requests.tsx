import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { useUploadPaymentProof } from '@/features/billing/hooks/use-upload-payment-proof'
import type { PaymentProof } from '@/features/billing/types'
import { ApproveSubscriptionRequestDialog } from '@/features/subscription-request/components/approve-subscription-request-dialog'
import { RejectSubscriptionRequestDialog } from '@/features/subscription-request/components/reject-subscription-request-dialog'
import { SubscriptionRequestTable } from '@/features/subscription-request/components/subscription-request-table'
import { useApproveSubscriptionRequest } from '@/features/subscription-request/hooks/use-approve-subscription-request'
import { useRejectSubscriptionRequest } from '@/features/subscription-request/hooks/use-reject-subscription-request'
import { useSubscriptionRequests } from '@/features/subscription-request/hooks/use-subscription-requests'
import {
  SUBSCRIPTION_REQUEST_STATUSES,
  type SubscriptionRequest,
  type SubscriptionRequestStatus,
} from '@/features/subscription-request/types'

const PAGE_LIMIT = 10
const ALL_STATUSES = 'ALL' as const
type StatusFilter = SubscriptionRequestStatus | typeof ALL_STATUSES

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function SubscriptionRequestsPage() {
  const { t } = useTranslation('subscriptionRequest')
  const { can } = useAuthPermissions()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [status, setStatus] = useState<StatusFilter>(ALL_STATUSES)
  const [approveTarget, setApproveTarget] = useState<SubscriptionRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<SubscriptionRequest | null>(null)
  const [paymentProof, setPaymentProof] = useState<PaymentProof | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const requestsQuery = useSubscriptionRequests({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
    filter: status === ALL_STATUSES ? {} : { status },
  })

  const approveRequest = useApproveSubscriptionRequest()
  const rejectRequest = useRejectSubscriptionRequest()
  const uploadPaymentProof = useUploadPaymentProof()

  const listTotal = requestsQuery.data?.total ?? 0
  const requestsForbidden = isForbiddenError(requestsQuery.error)
  const busyId = approveRequest.isPending
    ? approveRequest.variables?.id
    : rejectRequest.isPending
      ? rejectRequest.variables?.id
      : undefined

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

  function handleStatusChange(value: string) {
    setStatus(value as StatusFilter)
    setPage(1)
  }

  function openApprove(request: SubscriptionRequest) {
    setPaymentProof(null)
    uploadPaymentProof.reset()
    setApproveTarget(request)
  }

  function closeApprove() {
    setApproveTarget(null)
    setPaymentProof(null)
    uploadPaymentProof.reset()
  }

  function handleSelectProof(file: File) {
    uploadPaymentProof.mutate(file, { onSuccess: setPaymentProof })
  }

  function handleApprove() {
    if (!approveTarget) return
    approveRequest.mutate(
      {
        id: approveTarget.id,
        ...(paymentProof
          ? { paymentProofUrl: paymentProof.url, paymentProofName: paymentProof.filename }
          : {}),
      },
      {
        onSuccess: () => {
          closeApprove()
          toastSuccess(t('toast.approved'))
        },
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('toast.approveFailed')))
        },
      },
    )
  }

  function handleReject(note: string) {
    if (!rejectTarget) return
    rejectRequest.mutate(
      { id: rejectTarget.id, note: note || undefined },
      {
        onSuccess: () => {
          setRejectTarget(null)
          toastSuccess(t('toast.rejected'))
        },
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('toast.rejectFailed')))
        },
      },
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('search.placeholder')}
          ariaLabel={t('search.ariaLabel')}
        />
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-44" aria-label={t('filter.statusLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t('filter.all')}</SelectItem>
            {SUBSCRIPTION_REQUEST_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`statusOptions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {requestsQuery.isError ? (
        requestsForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('errors.load')}
          </div>
        )
      ) : (
        <>
          {requestsQuery.isPending ? (
            <TableSkeleton />
          ) : (
            <SubscriptionRequestTable
              items={requestsQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={() => {
                setSearch('')
                setPage(1)
              }}
              onView={(request) => navigate(`/subscription-requests/${request.id}`)}
              onApprove={openApprove}
              onReject={setRejectTarget}
              canApprove={can('subscription-request:approve')}
              canReject={can('subscription-request:reject')}
              busyId={busyId}
            />
          )}

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={listTotal}
            entityName={t('title')}
            isPending={requestsQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {approveTarget && (
        <ApproveSubscriptionRequestDialog
          name={approveTarget.fullName}
          isSubmitting={approveRequest.isPending}
          paymentProof={paymentProof}
          isUploadingProof={uploadPaymentProof.isPending}
          proofError={
            uploadPaymentProof.error
              ? getApiErrorMessage(uploadPaymentProof.error, t('approveDialog.proofFailed'))
              : null
          }
          onSelectProof={handleSelectProof}
          onRemoveProof={() => {
            setPaymentProof(null)
            uploadPaymentProof.reset()
          }}
          onConfirm={handleApprove}
          onOpenChange={(open) => {
            if (!open) closeApprove()
          }}
        />
      )}

      {rejectTarget && (
        <RejectSubscriptionRequestDialog
          name={rejectTarget.fullName}
          isSubmitting={rejectRequest.isPending}
          onConfirm={handleReject}
          onOpenChange={(open) => {
            if (!open) setRejectTarget(null)
          }}
        />
      )}
    </div>
  )
}
