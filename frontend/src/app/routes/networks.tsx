import { useEffect, useState } from 'react'
import { Plus, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { PublishScheduleDialog } from '@/components/shared/publish-schedule-dialog'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { DeleteNetworkDialog } from '@/features/network/components/delete-network-dialog'
import { NetworkTable } from '@/features/network/components/network-table'
import { listAllNetworkIds, MAX_BULK_IDS } from '@/features/network/api/networks'
import { useApproveNetwork } from '@/features/network/hooks/use-approve-network'
import { useDeleteNetwork } from '@/features/network/hooks/use-delete-network'
import { useBulkUpdateNetworkStatus } from '@/features/network/hooks/use-bulk-update-network-status'
import { useSubmitNetwork } from '@/features/network/hooks/use-submit-network'
import { useUnpublishNetwork } from '@/features/network/hooks/use-unpublish-network'
import { useNetworks } from '@/features/network/hooks/use-networks'
import { NETWORK_STATUSES, type BulkNetworkStatus, type Network } from '@/features/network/types'

const PAGE_LIMIT = 10
/** Batas `ids` per request (`ArrayMaxSize(100)` backend). */
const BULK_CHUNK_SIZE = 100
const ALL = 'ALL'

function NetworksTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

export function NetworksPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuthPermissions()
  // Target status bulk yang bisa dicapai user (hindari 403): REQUEST ← submit (DRAFT→REQUEST),
  // PUBLISHED ← publish/approve, DRAFT ← unpublish/reject. APPROVED tidak didukung endpoint.
  const bulkStatusOptions: BulkNetworkStatus[] = [
    ...(can('network:update') ? (['REQUEST'] as const) : []),
    ...(can('network:approve') ? (['PUBLISHED'] as const) : []),
    ...(can('network:reject') || can('network:unpublish') ? (['DRAFT'] as const) : []),
  ]
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [deletingNetwork, setDeletingNetwork] = useState<Network | null>(null)
  const [publishingNetwork, setPublishingNetwork] = useState<Network | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<BulkNetworkStatus>(() => bulkStatusOptions[0] ?? 'DRAFT')
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [isSelectingAll, setIsSelectingAll] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 400)
  const networksQuery = useNetworks({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
    filter: statusFilter ? { status: statusFilter } : undefined,
  })

  const deleteNetwork = useDeleteNetwork()
  const bulkUpdate = useBulkUpdateNetworkStatus()
  const submitNetwork = useSubmitNetwork()
  const approveNetwork = useApproveNetwork()
  const unpublishNetwork = useUnpublishNetwork()

  const listTotal = networksQuery.data?.total ?? 0
  const networksForbidden = isForbiddenError(networksQuery.error)
  const canCreateNetwork = can('network:create')
  const canBulkUpdate = can('network:update')
  const allSelected =
    listTotal > 0 && selectedIds.length >= Math.min(listTotal, MAX_BULK_IDS)
  const bulkPending = bulkUpdate.isPending || isSelectingAll
  // Default ke target pertama yang bisa dicapai; fallback bila pilihan lama tak lagi valid.
  const activeBulkStatus = bulkStatusOptions.includes(bulkStatus)
    ? bulkStatus
    : (bulkStatusOptions[0] ?? 'DRAFT')

  // Koreksi halaman yang keluar jangkauan setelah total berubah (mis. hapus item terakhir).
  // Clamp pagination boundary — setState di effect disengaja (bukan sync external system).
  useEffect(() => {
    if (listTotal > 0 && page > 1 && (page - 1) * PAGE_LIMIT >= listTotal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(Math.max(1, Math.ceil(listTotal / PAGE_LIMIT)))
    }
  }, [listTotal, page])

  // Pilihan lintas halaman (select-all) dipertahankan saat pindah halaman; reset hanya
  // saat kriteria berubah (search/filter/sort). ID usang (mis. sudah dihapus) aman —
  // transisi per-id; baris tak ditemukan dihitung `skipped` (404).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds([])
  }, [debouncedSearch, statusFilter, sortBy, sortOrder])

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

  function handleDelete() {
    if (!deletingNetwork) return
    deleteNetwork.mutate(deletingNetwork.id, {
      onSuccess: () => {
        setDeletingNetwork(null)
        toastSuccess(t('network:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('network:toast.deleteFailed')))
      },
    })
  }

  function handleSubmit(network: Network) {
    submitNetwork.mutate(network.id, {
      onSuccess: () => toastSuccess(t('network:toast.submitted')),
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('network:toast.submitFailed')))
      },
    })
  }

  function handleUnpublish(network: Network) {
    unpublishNetwork.mutate(network.id, {
      onSuccess: () => toastSuccess(t('network:toast.unpublished')),
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('network:toast.unpublishFailed')))
      },
    })
  }

  function handleConfirmPublish(publishedAt: string) {
    if (!publishingNetwork) return
    approveNetwork.mutate(
      { id: publishingNetwork.id, publishedAt },
      {
        onSuccess: () => {
          setPublishingNetwork(null)
          toastSuccess(t('network:toast.published'))
        },
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('network:toast.publishFailed')))
        },
      },
    )
  }

  async function handleToggleAll() {
    if (allSelected) {
      setSelectedIds([])
      return
    }
    setIsSelectingAll(true)
    try {
      const ids = await listAllNetworkIds({
        search: debouncedSearch,
        filter: statusFilter ? { status: statusFilter } : undefined,
      })
      setSelectedIds(ids)
    } catch (err: unknown) {
      toastError(getApiErrorMessage(err, t('network:toast.bulkSelectAllFailed')))
    } finally {
      setIsSelectingAll(false)
    }
  }

  async function handleBulkApply() {
    let updated = 0
    let skipped = 0
    let failed = 0
    let error: unknown = null
    // Backend membatasi `ids` maks 100 → kirim berurutan per batch, jumlahkan hasil.
    for (let i = 0; i < selectedIds.length; i += BULK_CHUNK_SIZE) {
      try {
        const result = await bulkUpdate.mutateAsync({
          ids: selectedIds.slice(i, i + BULK_CHUNK_SIZE),
          status: activeBulkStatus,
        })
        updated += result.updated
        skipped += result.skipped
        failed += result.failed
      } catch (err: unknown) {
        // Chunk gagal: hentikan loop, laporkan counter yang sudah terkumpul.
        error = err
        break
      }
    }
    if (updated > 0) toastSuccess(t('network:toast.bulkUpdated', { count: updated }))
    if (skipped > 0) toastError(t('network:bulk.skipped', { count: skipped }))
    if (failed > 0) toastError(t('network:bulk.failed', { count: failed }))
    else if (error !== null) {
      toastError(getApiErrorMessage(error, t('network:toast.bulkUpdateFailed')))
    }
    if (error !== null) return // Pilihan dipertahankan agar user bisa mengulang.
    setBulkConfirmOpen(false)
    setSelectedIds([])
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('network:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('network:subtitle')}</p>
        </div>
        {canCreateNetwork && (
          <Button onClick={() => navigate('/networks/new')}>
            <Plus data-icon="inline-start" className="size-4" />
            {t('network:add')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('network:search.placeholder')}
          ariaLabel={t('network:search.ariaLabel')}
        />
        <Select
          value={statusFilter || ALL}
          onValueChange={(value) => {
            setStatusFilter(value === ALL ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" aria-label={t('network:filter.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('network:filter.allStatuses')}</SelectItem>
            {NETWORK_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`network:statusOptions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canBulkUpdate && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('network:bulk.selected', { count: selectedIds.length })}
          </span>
          {bulkStatusOptions.length > 0 && (
            <>
              <Select
                value={activeBulkStatus}
                onValueChange={(value) => setBulkStatus(value as BulkNetworkStatus)}
                disabled={bulkPending}
              >
                <SelectTrigger size="sm" aria-label={t('network:bulk.statusLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bulkStatusOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`network:statusOptions.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setBulkConfirmOpen(true)} disabled={bulkPending}>
                {t('network:bulk.apply')}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds([])}
            disabled={bulkPending}
          >
            {t('network:bulk.clear')}
          </Button>
        </div>
      )}

      {networksQuery.isError ? (
        networksForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('network:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('network:errors.loadData')}
          </div>
        )
      ) : (
        <>
          {networksQuery.isPending ? (
            <NetworksTableSkeleton />
          ) : (
            <NetworkTable
              items={networksQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={(network) => navigate(`/networks/${network.id}/edit`)}
              onDelete={setDeletingNetwork}
              onSubmit={handleSubmit}
              onPublish={setPublishingNetwork}
              onUnpublish={handleUnpublish}
              canUpdate={can('network:update')}
              canDelete={can('network:delete')}
              canApprove={can('network:approve')}
              canUnpublish={can('network:unpublish')}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              allSelected={allSelected}
              onToggleAll={() => void handleToggleAll()}
              isSelectingAll={isSelectingAll}
              isBulkPending={bulkUpdate.isPending}
              canBulkUpdate={canBulkUpdate}
            />
          )}

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={networksQuery.data?.total ?? 0}
            entityName={t('network:title')}
            isPending={networksQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {deletingNetwork && (
        <DeleteNetworkDialog
          network={deletingNetwork}
          isSubmitting={deleteNetwork.isPending}
          onConfirm={handleDelete}
          onOpenChange={(open) => {
            if (!open) setDeletingNetwork(null)
          }}
        />
      )}

      <PublishScheduleDialog
        open={publishingNetwork !== null}
        onOpenChange={(open) => {
          if (!open) setPublishingNetwork(null)
        }}
        onConfirm={(publishedAt) => handleConfirmPublish(publishedAt)}
        isPending={approveNetwork.isPending}
        title={t('network:publishDialog.title')}
        description={t('network:publishDialog.description')}
        dateLabel={t('network:publishDialog.dateLabel')}
        datePlaceholder={t('network:publishDialog.datePlaceholder')}
        confirmLabel={t('network:publishDialog.confirm')}
        cancelLabel={t('common:actions.cancel')}
      />

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('network:bulk.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('network:bulk.confirmDescription', {
                count: selectedIds.length,
                status: t(`network:statusOptions.${activeBulkStatus}`),
              })}
              {activeBulkStatus === 'PUBLISHED' && (
                <span className="mt-2 block font-medium text-destructive">
                  {t('network:bulk.publishWarning')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkUpdate.isPending}>
              {t('network:bulk.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleBulkApply()
              }}
              disabled={bulkUpdate.isPending}
            >
              {t('network:bulk.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
