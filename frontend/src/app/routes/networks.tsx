import { useEffect, useState } from 'react'
import { Plus, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { DeleteNetworkDialog } from '@/features/network/components/delete-network-dialog'
import { NetworkTable } from '@/features/network/components/network-table'
import { useDeleteNetwork } from '@/features/network/hooks/use-delete-network'
import { useNetworks } from '@/features/network/hooks/use-networks'
import { NETWORK_STATUSES, type Network } from '@/features/network/types'

const PAGE_LIMIT = 10
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
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [deletingNetwork, setDeletingNetwork] = useState<Network | null>(null)

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

  const listTotal = networksQuery.data?.total ?? 0
  const networksForbidden = isForbiddenError(networksQuery.error)
  const canCreateNetwork = can('network:create')

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

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
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
              canUpdate={can('network:update')}
              canDelete={can('network:delete')}
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
    </div>
  )
}
