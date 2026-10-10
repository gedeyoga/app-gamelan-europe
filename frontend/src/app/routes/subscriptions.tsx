import { useEffect, useState } from 'react'
import { Plus, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CARD_GRID_CLASS } from '@/components/shared/card-grid'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { DeleteSubscriptionDialog } from '@/features/subscription/components/delete-subscription-dialog'
import { SubscriptionCardGrid } from '@/features/subscription/components/subscription-card-grid'
import { SubscriptionFormDialog } from '@/features/subscription/components/subscription-form-dialog'
import {
  SUBSCRIPTION_SORT_DEFAULT,
  SubscriptionSortControl,
} from '@/features/subscription/components/subscription-sort-control'
import { useCreateSubscription } from '@/features/subscription/hooks/use-create-subscription'
import { useDeleteSubscription } from '@/features/subscription/hooks/use-delete-subscription'
import { useSubscriptions } from '@/features/subscription/hooks/use-subscriptions'
import { useUpdateSubscription } from '@/features/subscription/hooks/use-update-subscription'
import type {
  CreateSubscriptionInput,
  Subscription,
  UpdateSubscriptionInput,
} from '@/features/subscription/types'

const PAGE_LIMIT = 10

function SubscriptionsCardSkeleton() {
  return (
    <div className={CARD_GRID_CLASS}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-4 rounded-xl border p-4"
          aria-hidden="true"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="h-8 w-1/2" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SubscriptionsPage() {
  const { t } = useTranslation()
  const { can } = useAuthPermissions()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const subscriptionsQuery = useSubscriptions({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
  })

  const createSubscription = useCreateSubscription()
  const updateSubscription = useUpdateSubscription()
  const deleteSubscription = useDeleteSubscription()

  const listTotal = subscriptionsQuery.data?.total ?? 0
  const subscriptionsForbidden = isForbiddenError(subscriptionsQuery.error)
  const canCreateSubscription = can('subscription:create')

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

  function handleSort(value: string) {
    if (value === SUBSCRIPTION_SORT_DEFAULT) {
      setSortBy(null)
      setSortOrder(null)
    } else {
      const [field, order] = value.split(':')
      setSortBy(field)
      setSortOrder(order === 'desc' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function handleResetSearch() {
    setSearch('')
    setPage(1)
  }

  function openCreateDialog() {
    setFormMode('create')
    setEditingSubscription(null)
    setFormOpen(true)
  }

  function openEditDialog(subscription: Subscription) {
    setFormMode('edit')
    setEditingSubscription(subscription)
    setFormOpen(true)
  }

  function handleCreate(payload: CreateSubscriptionInput) {
    createSubscription.mutate(payload, {
      onSuccess: () => {
        setFormOpen(false)
        toastSuccess(t('subscription:toast.created'))
      },
      onError: (err: unknown) => {
        // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('subscription:toast.createFailed')))
      },
    })
  }

  function handleUpdate(payload: UpdateSubscriptionInput) {
    if (!editingSubscription) return
    updateSubscription.mutate(
      { id: editingSubscription.id, payload },
      {
        onSuccess: () => {
          setFormOpen(false)
          toastSuccess(t('subscription:toast.updated'))
        },
        onError: (err: unknown) => {
          // 422 mengalir ke form via submissionError -> setError per-field; tanpa toast, dialog tetap terbuka.
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('subscription:toast.updateFailed')))
        },
      },
    )
  }

  function handleDelete() {
    if (!deletingSubscription) return
    deleteSubscription.mutate(deletingSubscription.id, {
      onSuccess: () => {
        setDeletingSubscription(null)
        toastSuccess(t('subscription:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('subscription:toast.deleteFailed')))
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('subscription:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subscription:subtitle')}</p>
        </div>
        {canCreateSubscription && (
          <Button onClick={openCreateDialog}>
            <Plus data-icon="inline-start" className="size-4" />
            {t('subscription:add')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('subscription:search.placeholder')}
          ariaLabel={t('subscription:search.ariaLabel')}
        />
        <div className="ml-auto">
          <SubscriptionSortControl sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
        </div>
      </div>

      {subscriptionsQuery.isError ? (
        subscriptionsForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('subscription:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('subscription:errors.loadData')}
          </div>
        )
      ) : (
        <>
          {subscriptionsQuery.isPending ? (
            <SubscriptionsCardSkeleton />
          ) : (
            <SubscriptionCardGrid
              items={subscriptionsQuery.data?.items ?? []}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={openEditDialog}
              onDelete={setDeletingSubscription}
              canUpdate={can('subscription:update')}
              canDelete={can('subscription:delete')}
            />
          )}

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={subscriptionsQuery.data?.total ?? 0}
            entityName={t('subscription:title')}
            isPending={subscriptionsQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {formOpen && (
        <SubscriptionFormDialog
          mode={formMode}
          subscription={editingSubscription}
          isSubmitting={
            formMode === 'create' ? createSubscription.isPending : updateSubscription.isPending
          }
          submissionError={
            formMode === 'create' ? createSubscription.error : updateSubscription.error
          }
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onOpenChange={setFormOpen}
        />
      )}

      {deletingSubscription && (
        <DeleteSubscriptionDialog
          subscription={deletingSubscription}
          isSubmitting={deleteSubscription.isPending}
          onConfirm={handleDelete}
          onOpenChange={(open) => {
            if (!open) setDeletingSubscription(null)
          }}
        />
      )}
    </div>
  )
}
