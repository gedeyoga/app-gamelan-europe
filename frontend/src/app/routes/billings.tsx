import { useEffect, useState } from 'react'
import { Plus, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { DeleteBillingDialog } from '@/features/billing/components/delete-billing-dialog'
import { BillingFormDialog } from '@/features/billing/components/billing-form-dialog'
import { BillingTable } from '@/features/billing/components/billing-table'
import { useBillings } from '@/features/billing/hooks/use-billings'
import { useCreateBilling } from '@/features/billing/hooks/use-create-billing'
import { useDeleteBilling } from '@/features/billing/hooks/use-delete-billing'
import { useUpdateBilling } from '@/features/billing/hooks/use-update-billing'
import type {
  Billing,
  BillingNetwork,
  BillingSubscription,
  BillingUser,
  CreateBillingInput,
  UpdateBillingInput,
} from '@/features/billing/types'
import { useNetworks } from '@/features/network/hooks/use-networks'
import { useSubscriptions } from '@/features/subscription/hooks/use-subscriptions'
import { useUsers } from '@/features/user/hooks/use-users'

const PAGE_LIMIT = 10
const OPTION_LIMIT = 100

function BillingsTableSkeleton() {
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
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formOpen, setFormOpen] = useState(false)
  const [editingBilling, setEditingBilling] = useState<Billing | null>(null)
  const [deletingBilling, setDeletingBilling] = useState<Billing | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const billingsQuery = useBillings({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
  })
  // Opsi form di-fetch lazy: hanya saat dialog terbuka + sesi punya permission baca terkait,
  // agar user tanpa permission tidak kena banner 403 permanen saat mount.
  const canReadUsers = can('user:read')
  const canReadNetworks = can('network:read')
  const canReadSubscriptions = can('subscription:read')
  const usersQuery = useUsers({
    page: 1,
    limit: OPTION_LIMIT,
    enabled: formOpen && canReadUsers,
  })
  const networksQuery = useNetworks({
    page: 1,
    limit: OPTION_LIMIT,
    enabled: formOpen && canReadNetworks,
  })
  const subscriptionsQuery = useSubscriptions({
    page: 1,
    limit: OPTION_LIMIT,
    enabled: formOpen && canReadSubscriptions,
  })

  const createBilling = useCreateBilling()
  const updateBilling = useUpdateBilling()
  const deleteBilling = useDeleteBilling()

  const userOptions: BillingUser[] = (usersQuery.data?.items ?? []).map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  }))
  const networkOptions: BillingNetwork[] = (networksQuery.data?.items ?? []).map((network) => ({
    id: network.id,
    name: network.name,
  }))
  const subscriptionOptions: BillingSubscription[] = (
    subscriptionsQuery.data?.items ?? []
  ).map((subscription) => ({
    id: subscription.id,
    name: subscription.name,
    slug: subscription.slug,
  }))

  const listTotal = billingsQuery.data?.total ?? 0
  const billingsForbidden = isForbiddenError(billingsQuery.error)
  const optionsError =
    (canReadUsers && usersQuery.isError) ||
    (canReadNetworks && networksQuery.isError) ||
    (canReadSubscriptions && subscriptionsQuery.isError)
  const canCreateBilling = can('billing:create')

  // Koreksi halaman yang keluar jangkauan setelah total berubah (mis. hapus item terakhir).
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

  function openCreateDialog() {
    setFormMode('create')
    setEditingBilling(null)
    setFormOpen(true)
  }

  function openEditDialog(billing: Billing) {
    setFormMode('edit')
    setEditingBilling(billing)
    setFormOpen(true)
  }

  function handleCreate(payload: CreateBillingInput) {
    createBilling.mutate(payload, {
      onSuccess: () => {
        setFormOpen(false)
        toastSuccess(t('billing:toast.created'))
      },
      onError: (err: unknown) => {
        // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('billing:toast.createFailed')))
      },
    })
  }

  function handleUpdate(payload: UpdateBillingInput) {
    if (!editingBilling) return
    updateBilling.mutate(
      { id: editingBilling.id, payload },
      {
        onSuccess: () => {
          setFormOpen(false)
          toastSuccess(t('billing:toast.updated'))
        },
        onError: (err: unknown) => {
          // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('billing:toast.updateFailed')))
        },
      },
    )
  }

  function handleDelete() {
    if (!deletingBilling) return
    deleteBilling.mutate(deletingBilling.id, {
      onSuccess: () => {
        setDeletingBilling(null)
        toastSuccess(t('billing:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('billing:toast.deleteFailed')))
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('billing:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('billing:subtitle')}</p>
        </div>
        {canCreateBilling && (
          <Button onClick={openCreateDialog}>
            <Plus data-icon="inline-start" className="size-4" />
            {t('billing:add')}
          </Button>
        )}
      </div>

      {optionsError && (
        <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          {t('billing:errors.loadOptions')}
        </div>
      )}

      <SearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder={t('billing:search.placeholder')}
        ariaLabel={t('billing:search.ariaLabel')}
      />

      {billingsQuery.isError ? (
        billingsForbidden ? (
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
          {billingsQuery.isPending ? (
            <BillingsTableSkeleton />
          ) : (
            <BillingTable
              items={billingsQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={openEditDialog}
              onDelete={setDeletingBilling}
              canUpdate={can('billing:update')}
              canDelete={can('billing:delete')}
            />
          )}

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={billingsQuery.data?.total ?? 0}
            entityName={t('billing:title')}
            isPending={billingsQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {formOpen && (
        <BillingFormDialog
          mode={formMode}
          billing={editingBilling}
          users={userOptions}
          networks={networkOptions}
          subscriptions={subscriptionOptions}
          canSelectUser={canReadUsers}
          canSelectNetwork={canReadNetworks}
          canSelectSubscription={canReadSubscriptions}
          isSubmitting={formMode === 'create' ? createBilling.isPending : updateBilling.isPending}
          submissionError={formMode === 'create' ? createBilling.error : updateBilling.error}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onOpenChange={setFormOpen}
        />
      )}

      {deletingBilling && (
        <DeleteBillingDialog
          billing={deletingBilling}
          isSubmitting={deleteBilling.isPending}
          onConfirm={handleDelete}
          onOpenChange={(open) => {
            if (!open) setDeletingBilling(null)
          }}
        />
      )}
    </div>
  )
}
