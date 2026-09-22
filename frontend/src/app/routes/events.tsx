import { useEffect, useState } from 'react'
import { LayoutGrid, List, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Toggle } from '@/components/ui/toggle'
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
import { useDeleteEvent } from '@/features/event/hooks/use-delete-event'
import { useEvents } from '@/features/event/hooks/use-events'
import type { Event } from '@/features/event/types'

import { OrgEventsPage } from './events-org'

const PAGE_LIMIT = 10

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
  const { can } = useAuthPermissions()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<ListSortOrder | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const eventsQuery = useEvents({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch,
    sortBy,
    sortOrder,
  })
  const deleteEvent = useDeleteEvent()

  const listTotal = eventsQuery.data?.total ?? 0
  const eventsForbidden = isForbiddenError(eventsQuery.error)
  const canCreateEvent = can('event:create')

  // Clamp pagination boundary setelah total berubah (mis. hapus item terakhir).
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
      </div>

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
