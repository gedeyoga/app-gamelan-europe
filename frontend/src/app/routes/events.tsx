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
import { EventCard } from '@/features/event/components/event-card'
import { EventTable } from '@/features/event/components/event-table'
import { listAllEventIds, MAX_BULK_IDS } from '@/features/event/api/events'
import { useBulkDeleteEvent } from '@/features/event/hooks/use-bulk-delete-event'
import { useBulkUpdateEventStatus } from '@/features/event/hooks/use-bulk-update-event-status'
import { useDeleteEvent } from '@/features/event/hooks/use-delete-event'
import { useEvents } from '@/features/event/hooks/use-events'
import { useEventTypes } from '@/features/event/hooks/use-event-types'
import { CONTENT_STATUSES } from '@/features/event/types'
import type { ContentStatus, Event } from '@/features/event/types'

import { OrgEventsPage } from './events-org'

const PAGE_LIMIT = 10
/** Batas `ids` per request (`ArrayMaxSize(100)` backend). */
const BULK_CHUNK_SIZE = 100
const ALL = 'ALL'

type ViewMode = 'card' | 'list'

function EventsTableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EventsCardSkeleton() {
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

function AdminEventsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can, canAny } = useAuthPermissions()
  // Target status bulk yang bisa dicapai user (hindari 403): DRAFT ← reject/unpublish,
  // REQUEST ← submit, PUBLISHED ← approve/publish. APPROVED tidak ditawarkan (tanpa transisi).
  const bulkStatusOptions: ContentStatus[] = [
    ...(canAny(['event:reject', 'event:unpublish']) ? (['DRAFT'] as const) : []),
    ...(can('event:submit') ? (['REQUEST'] as const) : []),
    ...(canAny(['event:approve', 'event:publish']) ? (['PUBLISHED'] as const) : []),
  ]
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null)
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

  const eventTypesQuery = useEventTypes(can('event-type:read'))
  const eventTypes = eventTypesQuery.data?.items ?? []

  const eventsQuery = useEvents({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
    eventTypeId: eventTypeFilter || undefined,
    filter,
  })
  const deleteEvent = useDeleteEvent()
  const bulkUpdate = useBulkUpdateEventStatus()
  const bulkDelete = useBulkDeleteEvent()

  const listTotal = eventsQuery.data?.total ?? 0
  const eventsForbidden = isForbiddenError(eventsQuery.error)
  const canCreateEvent = can('event:create')
  const canBulkUpdate = can('event:update')
  const canBulkDelete = can('event:delete')
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
  }, [debouncedSearch, statusFilter, eventTypeFilter, sortBy, sortOrder])

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
    if (!deletingEvent) return
    deleteEvent.mutate(deletingEvent.id, {
      onSuccess: () => {
        setDeletingEvent(null)
        toastSuccess(t('event:toast.deleted'))
      },
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('event:toast.deleteFailed')))
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
      const ids = await listAllEventIds({
        search: debouncedSearch,
        eventTypeId: eventTypeFilter || undefined,
        filter,
      })
      setSelectedIds(ids)
    } catch (err: unknown) {
      toastError(getApiErrorMessage(err, t('event:toast.bulkSelectAllFailed')))
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
    if (updated > 0) toastSuccess(t('event:toast.bulkUpdated', { count: updated }))
    if (skipped > 0) toastError(t('event:bulk.skipped', { count: skipped }))
    if (failed > 0) toastError(t('event:bulk.failed', { count: failed }))
    else if (error !== null) {
      toastError(getApiErrorMessage(error, t('event:toast.bulkUpdateFailed')))
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
    if (deleted > 0) toastSuccess(t('event:toast.bulkDeleted', { count: deleted }))
    if (failed > 0) toastError(t('event:bulk.failed', { count: failed }))
    else if (error !== null) {
      toastError(getApiErrorMessage(error, t('event:toast.bulkDeleteFailed')))
    }
    if (error !== null) return
    setBulkAction(null)
    setSelectedIds([])
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('event:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('event:subtitle')}</p>
        </div>
        {canCreateEvent && (
          <Button onClick={() => navigate('/events/new')}>
            <Plus className="size-4" data-icon="inline-start" />
            {t('event:add')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder={t('event:search.placeholder')}
          ariaLabel={t('event:search.ariaLabel')}
        />
        <Select
          value={statusFilter || ALL}
          onValueChange={(value) => {
            setStatusFilter(value === ALL ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" aria-label={t('event:filter.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('event:filter.allStatuses')}</SelectItem>
            {CONTENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`event:statusOptions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={eventTypeFilter || ALL}
          onValueChange={(value) => {
            setEventTypeFilter(value === ALL ? '' : value)
            setPage(1)
          }}
        >
          <SelectTrigger size="sm" aria-label={t('event:filter.eventType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('event:filter.allEventTypes')}</SelectItem>
            {eventTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="inline-flex items-center rounded-md border p-0.5">
          <Toggle
            size="sm"
            pressed={viewMode === 'card'}
            onPressedChange={() => setViewMode('card')}
            aria-label={t('event:view.card')}
          >
            <LayoutGrid className="size-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={viewMode === 'list'}
            onPressedChange={() => setViewMode('list')}
            aria-label={t('event:view.list')}
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
              aria-label={t('event:bulk.selectAll')}
            />
            <span className="text-sm text-muted-foreground">{t('event:bulk.selectAllLabel')}</span>
            {isSelectingAll && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </span>
        )}
      </div>

      {canBulk && selectedIds.length > 0 && (
        <div
          role="region"
          aria-label={t('event:bulk.regionLabel')}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-sm text-muted-foreground">
            {t('event:bulk.selected', { count: selectedIds.length })}
          </span>
          {canBulkUpdate && bulkStatusOptions.length > 0 && (
            <>
              <Select
                value={activeBulkStatus}
                onValueChange={(value) => setBulkStatus(value as ContentStatus)}
                disabled={bulkBusy}
              >
                <SelectTrigger size="sm" aria-label={t('event:bulk.statusLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bulkStatusOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`event:statusOptions.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setBulkAction('status')} disabled={bulkBusy}>
                {t('event:bulk.apply')}
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
              {t('event:bulk.delete')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedIds([])}
            disabled={bulkBusy}
          >
            {t('event:bulk.clear')}
          </Button>
        </div>
      )}

      {eventsQuery.isError ? (
        eventsForbidden ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('event:errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('event:errors.loadData')}
          </div>
        )
      ) : (
        <>
          {eventsQuery.isPending ? (
            viewMode === 'card' ? (
              <EventsCardSkeleton />
            ) : (
              <EventsTableSkeleton />
            )
          ) : viewMode === 'card' ? (
            <EventCard
              items={eventsQuery.data?.items ?? []}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={(event) => navigate(`/events/${event.id}/edit`)}
              onDelete={setDeletingEvent}
              onCreate={() => navigate('/events/new')}
              canUpdate={can('event:update')}
              canDelete={can('event:delete')}
              canCreate={canCreateEvent}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              isSelectingAll={isSelectingAll}
              isBulkPending={bulkPending}
              canBulkUpdate={canBulk}
            />
          ) : (
            <EventTable
              items={eventsQuery.data?.items ?? []}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              searchTerm={debouncedSearch}
              onResetSearch={handleResetSearch}
              onEdit={(event) => navigate(`/events/${event.id}/edit`)}
              onDelete={setDeletingEvent}
              onCreate={() => navigate('/events/new')}
              canUpdate={can('event:update')}
              canDelete={can('event:delete')}
              canCreate={canCreateEvent}
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
            total={eventsQuery.data?.total ?? 0}
            entityName={t('event:title')}
            isPending={eventsQuery.isPending}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}

      {deletingEvent && (
        <AlertDialog open onOpenChange={(open) => !open && setDeletingEvent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('event:delete.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('event:delete.description', { name: deletingEvent.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline" disabled={deleteEvent.isPending}>
                  <X className="size-4" data-icon="inline-start" />
                  {t('common:actions.cancel')}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteEvent.isPending}
                  onClick={handleDelete}
                >
                  <Trash2 className="size-4" data-icon="inline-start" />
                  {deleteEvent.isPending
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
            <AlertDialogTitle>{t('event:bulk.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('event:bulk.confirmDescription', {
                count: selectedIds.length,
                status: t(`event:statusOptions.${activeBulkStatus}`),
              })}
              {activeBulkStatus === 'PUBLISHED' && (
                <span className="mt-2 block font-medium text-destructive">
                  {t('event:bulk.publishWarning')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>{t('event:bulk.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleBulkApply()
              }}
              disabled={bulkPending}
            >
              {t('event:bulk.confirm')}
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
            <AlertDialogTitle>{t('event:bulk.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('event:bulk.deleteDescription', { count: selectedIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>{t('event:bulk.cancel')}</AlertDialogCancel>
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
                {t('event:bulk.delete')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Dispatcher dua view berbasis permission (tanpa nama role).
 * Admin = scope `all` backend: salah satu dari `event:approve|publish|reject|unpublish`; role org/member tidak.
 */
export function EventsPage() {
  const { canAny } = useAuthPermissions()
  return canAny([
    'event:approve',
    'event:publish',
    'event:reject',
    'event:unpublish',
  ]) ? (
    <AdminEventsPage />
  ) : (
    <OrgEventsPage />
  )
}
