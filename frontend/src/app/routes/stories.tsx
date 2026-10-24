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
import { StoryCard } from '@/features/story/components/story-card'
import { StoryTable } from '@/features/story/components/story-table'
import { listAllPostIds, MAX_BULK_IDS } from '@/features/story/api/posts'
import { useBulkDeleteStory } from '@/features/story/hooks/use-bulk-delete-story'
import { useBulkUpdateStoryStatus } from '@/features/story/hooks/use-bulk-update-story-status'
import { useDeleteStory } from '@/features/story/hooks/use-delete-story'
import { useStories } from '@/features/story/hooks/use-stories'
import { useCategories } from '@/features/story/hooks/use-categories'
import { CONTENT_STATUSES } from '@/features/story/types'
import type { ContentStatus, Story } from '@/features/story/types'

const PAGE_LIMIT = 10
/** Batas `ids` per request (`ArrayMaxSize(100)` backend). */
const BULK_CHUNK_SIZE = 100
const ALL = 'ALL'

type ViewMode = 'card' | 'list'

function StoriesTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

function StoriesCardSkeleton() {
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

export function StoriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can, canAny } = useAuthPermissions()
  // Target status bulk yang bisa dicapai user (hindari 403): DRAFT ← reject/unpublish,
  // REQUEST ← submit, PUBLISHED ← approve/publish. APPROVED tidak ditawarkan (tanpa transisi).
  const bulkStatusOptions: ContentStatus[] = [
    ...(canAny(['story:reject', 'story:unpublish']) ? (['DRAFT'] as const) : []),
    ...(can('story:submit') ? (['REQUEST'] as const) : []),
    ...(canAny(['story:approve', 'story:publish']) ? (['PUBLISHED'] as const) : []),
  ]
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [deletingStory, setDeletingStory] = useState<Story | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<ContentStatus>('DRAFT')
  const [bulkAction, setBulkAction] = useState<'status' | 'delete' | null>(null)
  const [isSelectingAll, setIsSelectingAll] = useState(false)

  const debouncedSearch = useDebouncedValue(search, 400)

  const filter = useMemo(() => {
    const next: Record<string, string> = {}
    if (statusFilter) next.status = statusFilter
    return next
  }, [statusFilter])

  const categoriesQuery = useCategories(can('category:read'))
  const categories = categoriesQuery.data?.items ?? []

  const storiesQuery = useStories({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
    categoryId: categoryFilter || undefined,
    filter,
  })
  const deleteStory = useDeleteStory()
  const bulkUpdate = useBulkUpdateStoryStatus()
  const bulkDelete = useBulkDeleteStory()

  const listTotal = storiesQuery.data?.total ?? 0
  const storiesForbidden = isForbiddenError(storiesQuery.error)
  const canCreateStory = can('story:create')
  const canBulkUpdate = can('story:update')
  const canBulkDelete = can('story:delete')
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
  }, [debouncedSearch, statusFilter, categoryFilter, sortBy, sortOrder])

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
    if (!deletingStory) return
    deleteStory.mutate(deletingStory.id, {
      onSuccess: () => {
        setDeletingStory(null)
        toastSuccess(t('story:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('story:toast.deleteFailed')))
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
      const ids = await listAllPostIds({
        search: debouncedSearch,
        categoryId: categoryFilter || undefined,
        filter,
      })
      setSelectedIds(ids)
    } catch (err: unknown) {
      toastError(getApiErrorMessage(err, t('story:toast.bulkSelectAllFailed')))
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
    if (updated > 0) toastSuccess(t('story:toast.bulkUpdated', { count: updated }))
    if (skipped > 0) toastError(t('story:bulk.skipped', { count: skipped }))
    if (failed > 0) toastError(t('story:bulk.failed', { count: failed }))
    else if (error !== null) {
      toastError(getApiErrorMessage(error, t('story:toast.bulkUpdateFailed')))
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
    if (deleted > 0) toastSuccess(t('story:toast.bulkDeleted', { count: deleted }))
    if (failed > 0) toastError(t('story:bulk.failed', { count: failed }))
    else if (error !== null) {
      toastError(getApiErrorMessage(error, t('story:toast.bulkDeleteFailed')))
    }
    if (error !== null) return
    setBulkAction(null)
    setSelectedIds([])
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('story:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('story:subtitle')}</p>
        </div>
        {canCreateStory && (
          <Button onClick={() => navigate('/stories/new')}>
            <Plus className="size-4" data-icon="inline-start" />
            {t('story:add')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('story:search.placeholder')}
          ariaLabel={t('story:search.ariaLabel')}
        />
        <Select
          value={statusFilter || ALL}
          onValueChange={(value) => {
            setStatusFilter(value === ALL ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" aria-label={t('story:filter.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('story:filter.allStatuses')}</SelectItem>
            {CONTENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`story:statusOptions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter || ALL}
          onValueChange={(value) => {
            setCategoryFilter(value === ALL ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" aria-label={t('story:filter.category')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('story:filter.allCategories')}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="inline-flex items-center rounded-md border p-0.5">
          <Toggle
            size="sm"
            pressed={viewMode === 'card'}
            onPressedChange={() => setViewMode('card')}
            aria-label={t('story:view.card')}
          >
            <LayoutGrid className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={viewMode === 'list'}
            onPressedChange={() => setViewMode('list')}
            aria-label={t('story:view.list')}
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
              aria-label={t('story:bulk.selectAll')}
            />
            <span className="text-sm text-muted-foreground">{t('story:bulk.selectAllLabel')}</span>
            {isSelectingAll && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </span>
        )}
      </div>

      {canBulk && selectedIds.length > 0 && (
        <div
          role="region"
          aria-label={t('story:bulk.regionLabel')}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-sm text-muted-foreground">
            {t('story:bulk.selected', { count: selectedIds.length })}
          </span>
          {canBulkUpdate && bulkStatusOptions.length > 0 && (
            <>
              <Select
                value={activeBulkStatus}
                onValueChange={(value) => setBulkStatus(value as ContentStatus)}
                disabled={bulkBusy}
              >
                <SelectTrigger size="sm" aria-label={t('story:bulk.statusLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bulkStatusOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`story:statusOptions.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setBulkAction('status')} disabled={bulkBusy}>
                {t('story:bulk.apply')}
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
              {t('story:bulk.delete')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds([])}
            disabled={bulkBusy}
          >
            {t('story:bulk.clear')}
          </Button>
        </div>
      )}

      {storiesQuery.isError ? (
        storiesForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('story:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('story:errors.loadData')}
          </div>
        )
      ) : (
        <>
          {storiesQuery.isPending ? (
            viewMode === 'card' ? (
              <StoriesCardSkeleton />
            ) : (
              <StoriesTableSkeleton />
            )
          ) : viewMode === 'card' ? (
            <StoryCard
              items={storiesQuery.data?.items ?? []}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={(story) => navigate(`/stories/${story.id}/edit`)}
              onDelete={setDeletingStory}
              onCreate={() => navigate('/stories/new')}
              canUpdate={can('story:update')}
              canDelete={can('story:delete')}
              canCreate={canCreateStory}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              isSelectingAll={isSelectingAll}
              isBulkPending={bulkPending}
              canBulkUpdate={canBulk}
            />
          ) : (
            <StoryTable
              items={storiesQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={(story) => navigate(`/stories/${story.id}/edit`)}
              onDelete={setDeletingStory}
              onCreate={() => navigate('/stories/new')}
              canUpdate={can('story:update')}
              canDelete={can('story:delete')}
              canCreate={canCreateStory}
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
            total={storiesQuery.data?.total ?? 0}
            entityName={t('story:title')}
            isPending={storiesQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {deletingStory && (
        <AlertDialog open onOpenChange={(open) => !open && setDeletingStory(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('story:delete.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('story:delete.description', { name: deletingStory.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline" disabled={deleteStory.isPending}>
                  <X className="size-4" data-icon="inline-start" />
                  {t('common:actions.cancel')}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteStory.isPending}
                  onClick={handleDelete}
                >
                  <Trash2 className="size-4" data-icon="inline-start" />
                  {deleteStory.isPending
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
            <AlertDialogTitle>{t('story:bulk.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('story:bulk.confirmDescription', {
                count: selectedIds.length,
                status: t(`story:statusOptions.${activeBulkStatus}`),
              })}
              {activeBulkStatus === 'PUBLISHED' && (
                <span className="mt-2 block font-medium text-destructive">
                  {t('story:bulk.publishWarning')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>{t('story:bulk.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleBulkApply()
              }}
              disabled={bulkPending}
            >
              {t('story:bulk.confirm')}
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
            <AlertDialogTitle>{t('story:bulk.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('story:bulk.deleteDescription', { count: selectedIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>{t('story:bulk.cancel')}</AlertDialogCancel>
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
                {t('story:bulk.delete')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
