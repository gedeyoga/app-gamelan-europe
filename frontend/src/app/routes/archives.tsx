import { useEffect, useMemo, useState } from 'react'
import { LayoutGrid, List, Loader2, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Toggle } from '@/components/ui/toggle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { CARD_GRID_CLASS } from '@/components/shared/card-grid'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { SearchBar } from '@/components/shared/search-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { nextSort, type ListSortOrder } from '@/lib/list-params'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { ArchiveCard } from '@/features/archive/components/archive-card'
import { ArchiveTable } from '@/features/archive/components/archive-table'
import { listAllArchiveIds, MAX_BULK_IDS } from '@/features/archive/api/archives'
import { useBulkDeleteArchive } from '@/features/archive/hooks/use-bulk-delete-archive'
import { useBulkUpdateArchiveStatus } from '@/features/archive/hooks/use-bulk-update-archive-status'
import { useArchives } from '@/features/archive/hooks/use-archives'
import { useDeleteArchive } from '@/features/archive/hooks/use-delete-archive'
import { ARCHIVE_STATUSES, ARCHIVE_TYPES } from '@/features/archive/types'
import type { Archive, ArchiveStatus } from '@/features/archive/types'

const PAGE_LIMIT = 10
/** Batas `ids` per request (`ArrayMaxSize(100)` backend). */
const BULK_CHUNK_SIZE = 100
const ALL = 'ALL'

type ViewMode = 'card' | 'list'

function ArchivesTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

function ArchivesCardSkeleton() {
  return (
    <div className={CARD_GRID_CLASS}>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function ArchivesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can, canAny } = useAuthPermissions()
  // Target status bulk yang bisa dicapai user (hindari 403): DRAFT ← reject/unpublish,
  // REQUEST ← submit, PUBLISHED ← approve/publish. APPROVED tidak ditawarkan (tanpa transisi).
  const bulkStatusOptions: ArchiveStatus[] = [
    ...(canAny(['archive:reject', 'archive:unpublish']) ? (['DRAFT'] as const) : []),
    ...(can('archive:submit') ? (['REQUEST'] as const) : []),
    ...(canAny(['archive:approve', 'archive:publish']) ? (['PUBLISHED'] as const) : []),
  ]
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [deletingArchive, setDeletingArchive] = useState<Archive | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<ArchiveStatus>('DRAFT')
  const [bulkAction, setBulkAction] = useState<'status' | 'delete' | null>(null)
  const [isSelectingAll, setIsSelectingAll] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 400)

  const filter = useMemo(() => {
    const next: Record<string, string> = {}
    if (typeFilter) next.type = typeFilter
    if (statusFilter) next.status = statusFilter
    return next
  }, [typeFilter, statusFilter])

  // Non-admin hanya melihat arsip miliknya (`mine=true`); admin melihat semua.
  const isArchiveAdmin = canAny([
    'archive:approve',
    'archive:reject',
    'archive:publish',
    'archive:unpublish',
  ])

  const archivesQuery = useArchives({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
    mine: !isArchiveAdmin,
    filter,
  })
  const deleteArchive = useDeleteArchive()
  const bulkUpdate = useBulkUpdateArchiveStatus()
  const bulkDelete = useBulkDeleteArchive()

  const listTotal = archivesQuery.data?.total ?? 0
  const archivesForbidden = isForbiddenError(archivesQuery.error)
  const canCreateArchive = can('archive:create')
  const canBulkUpdate = can('archive:update')
  const canBulkDelete = can('archive:delete')
  const canBulk = canBulkUpdate || canBulkDelete
  const allSelected =
    listTotal > 0 && selectedIds.length >= Math.min(listTotal, MAX_BULK_IDS)
  // Default ke satu-satunya target yang bisa dicapai; fallback bila pilihan lama tak lagi valid.
  const activeBulkStatus = bulkStatusOptions.includes(bulkStatus)
    ? bulkStatus
    : (bulkStatusOptions[0] ?? 'DRAFT')
  const someSelected = selectedIds.length > 0 && !allSelected
  const bulkPending = bulkUpdate.isPending || bulkDelete.isPending
  const bulkBusy = bulkPending || isSelectingAll

  // Clamp pagination boundary setelah total berubah (mis. hapus item terakhir).
  useEffect(() => {
    if (listTotal > 0 && page > 1 && (page - 1) * PAGE_LIMIT >= listTotal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(Math.max(1, Math.ceil(listTotal / PAGE_LIMIT)))
    }
  }, [listTotal, page])

  // Pilihan lintas halaman dipertahankan saat pindah halaman; reset hanya saat
  // kriteria berubah (search/filter/sort). ID usang aman — endpoint bulk idempotent.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds([])
  }, [debouncedSearch, typeFilter, statusFilter, sortBy, sortOrder])

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
    if (!deletingArchive) return
    deleteArchive.mutate(deletingArchive.id, {
      onSuccess: () => {
        setDeletingArchive(null)
        toastSuccess(t('archive:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('archive:toast.deleteFailed')))
      },
    })
  }

  async function handleToggleAll() {
    if (allSelected) {
      setSelectedIds([])
      return
    }
    setIsSelectingAll(true)
    try {
      const ids = await listAllArchiveIds({
        search: debouncedSearch,
        mine: !isArchiveAdmin,
        filter,
      })
      setSelectedIds(ids)
    } catch (err: unknown) {
      toastError(getApiErrorMessage(err, t('archive:toast.bulkSelectAllFailed')))
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
    if (updated > 0) toastSuccess(t('archive:toast.bulkUpdated', { count: updated }))
    if (skipped > 0) toastError(t('archive:bulk.skipped', { count: skipped }))
    if (failed > 0) toastError(t('archive:bulk.failed', { count: failed }))
    else if (error !== null) {
      toastError(getApiErrorMessage(error, t('archive:toast.bulkUpdateFailed')))
    }
    if (error !== null) return // Pilihan dipertahankan agar user bisa mengulang.
    setBulkAction(null)
    setSelectedIds([])
  }

  async function handleBulkDelete() {
    let deleted = 0
    let failed = 0
    let error: unknown = null
    for (let i = 0; i < selectedIds.length; i += BULK_CHUNK_SIZE) {
      try {
        const result = await bulkDelete.mutateAsync({
          ids: selectedIds.slice(i, i + BULK_CHUNK_SIZE),
        })
        deleted += result.deleted
        failed += result.failed
      } catch (err: unknown) {
        // Chunk gagal: hentikan loop, laporkan counter yang sudah terkumpul.
        error = err
        break
      }
    }
    if (deleted > 0) toastSuccess(t('archive:toast.bulkDeleted', { count: deleted }))
    if (failed > 0) toastError(t('archive:bulk.failed', { count: failed }))
    else if (error !== null) {
      toastError(getApiErrorMessage(error, t('archive:toast.bulkDeleteFailed')))
    }
    if (error !== null) return
    setBulkAction(null)
    setSelectedIds([])
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('archive:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('archive:subtitle')}</p>
        </div>
        {canCreateArchive && (
          <Button onClick={() => navigate('/archives/new')}>
            <Plus className="size-4" data-icon="inline-start" />
            {t('archive:add')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('archive:search.placeholder')}
          ariaLabel={t('archive:search.ariaLabel')}
        />
        <Select
          value={typeFilter || ALL}
          onValueChange={(value) => {
            setTypeFilter(value === ALL ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" aria-label={t('archive:filter.type')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('archive:filter.allTypes')}</SelectItem>
            {ARCHIVE_TYPES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`archive:typeOptions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter || ALL}
          onValueChange={(value) => {
            setStatusFilter(value === ALL ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" aria-label={t('archive:filter.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('archive:filter.allStatuses')}</SelectItem>
            {ARCHIVE_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`archive:statusOptions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="inline-flex items-center rounded-md border p-0.5">
          <Toggle
            size="sm"
            pressed={viewMode === 'card'}
            onPressedChange={() => setViewMode('card')}
            aria-label={t('archive:view.card')}
          >
            <LayoutGrid className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={viewMode === 'list'}
            onPressedChange={() => setViewMode('list')}
            aria-label={t('archive:view.list')}
          >
            <List className="size-4" />
          </Toggle>
        </div>
        {canBulk && listTotal > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={() => void handleToggleAll()}
              disabled={bulkBusy}
              aria-label={t('archive:bulk.selectAll')}
            />
            <span className="text-sm text-muted-foreground">
              {t('archive:bulk.selectAllLabel')}
            </span>
            {isSelectingAll && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </span>
        )}
      </div>

      {canBulk && selectedIds.length > 0 && (
        <div
          role="region"
          aria-label={t('archive:bulk.regionLabel')}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-sm text-muted-foreground">
            {t('archive:bulk.selected', { count: selectedIds.length })}
          </span>
          {canBulkUpdate && bulkStatusOptions.length > 0 && (
            <>
              <Select
                value={activeBulkStatus}
                onValueChange={(value) => setBulkStatus(value as ArchiveStatus)}
                disabled={bulkBusy}
              >
                <SelectTrigger size="sm" aria-label={t('archive:bulk.statusLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bulkStatusOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`archive:statusOptions.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setBulkAction('status')} disabled={bulkBusy}>
                {t('archive:bulk.apply')}
              </Button>
            </>
          )}
          {canBulkDelete && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkAction('delete')}
              disabled={bulkBusy}
            >
              {t('archive:bulk.delete')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds([])}
            disabled={bulkBusy}
          >
            {t('archive:bulk.clear')}
          </Button>
        </div>
      )}

      {archivesQuery.isError ? (
        archivesForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('archive:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('archive:errors.loadData')}
          </div>
        )
      ) : (
        <>
          {archivesQuery.isPending ? (
            viewMode === 'card' ? (
              <ArchivesCardSkeleton />
            ) : (
              <ArchivesTableSkeleton />
            )
          ) : viewMode === 'card' ? (
            <ArchiveCard
              items={archivesQuery.data?.items ?? []}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={(archive) => navigate(`/archives/${archive.id}/edit`)}
              onDelete={setDeletingArchive}
              onCreate={() => navigate('/archives/new')}
              canUpdate={can('archive:update')}
              canDelete={can('archive:delete')}
              canCreate={canCreateArchive}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              isSelectingAll={isSelectingAll}
              isBulkPending={bulkPending}
              canBulkUpdate={canBulk}
            />
          ) : (
            <ArchiveTable
              items={archivesQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={(archive) => navigate(`/archives/${archive.id}/edit`)}
              onDelete={setDeletingArchive}
              onCreate={() => navigate('/archives/new')}
              canUpdate={can('archive:update')}
              canDelete={can('archive:delete')}
              canCreate={canCreateArchive}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              allSelected={allSelected}
              onToggleAll={() => void handleToggleAll()}
              isSelectingAll={isSelectingAll}
              isBulkPending={bulkPending}
              canBulkUpdate={canBulk}
            />
          )}

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={archivesQuery.data?.total ?? 0}
            entityName={t('archive:title')}
            isPending={archivesQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {deletingArchive && (
        <AlertDialog open onOpenChange={(open) => !open && setDeletingArchive(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('archive:delete.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('archive:delete.description', { name: deletingArchive.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline" disabled={deleteArchive.isPending}>
                  <X className="size-4" data-icon="inline-start" />
                  {t('common:actions.cancel')}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteArchive.isPending}
                  onClick={handleDelete}
                >
                  <Trash2 className="size-4" data-icon="inline-start" />
                  {deleteArchive.isPending
                    ? t('common:actions.deleting')
                    : t('common:actions.delete')}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog
        open={bulkAction === 'status'}
        onOpenChange={(open) => {
          if (!open && !bulkPending) setBulkAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archive:bulk.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('archive:bulk.confirmDescription', {
                count: selectedIds.length,
                status: t(`archive:statusOptions.${activeBulkStatus}`),
              })}
              {activeBulkStatus === 'PUBLISHED' && (
                <span className="mt-2 block font-medium text-destructive">
                  {t('archive:bulk.publishWarning')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>{t('archive:bulk.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleBulkApply()
              }}
              disabled={bulkPending}
            >
              {t('archive:bulk.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkAction === 'delete'}
        onOpenChange={(open) => {
          if (!open && !bulkPending) setBulkAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archive:bulk.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('archive:bulk.deleteDescription', { count: selectedIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>{t('archive:bulk.cancel')}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={bulkPending}
                onClick={(e) => {
                  e.preventDefault()
                  void handleBulkDelete()
                }}
              >
                <Trash2 className="size-4" data-icon="inline-start" />
                {t('archive:bulk.delete')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
