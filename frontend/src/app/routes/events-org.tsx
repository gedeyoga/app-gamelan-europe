import { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
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
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { EventMonthSection } from '@/features/event/components/event-month-section'
import { MyEventList } from '@/features/event/components/my-event-list'
import { useDeleteEvent } from '@/features/event/hooks/use-delete-event'
import { useEvents } from '@/features/event/hooks/use-events'
import type { Event } from '@/features/event/types'

// Ponytail: seksi bulan tanpa pagination — naikkan/beri pagination bila user bisa >100 event.
const SECTION_LIMIT = 100
const MY_EVENT_LIMIT = 10

function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function toEventMonth(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
}

/** View non-admin: "Event bulan ini" (grid) + "My Event" (tabel). */
export function OrgEventsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { can } = useAuthPermissions()
  const [month, setMonth] = useState(startOfCurrentMonth)
  const [myEventPage, setMyEventPage] = useState(1)
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null)

  const eventMonth = toEventMonth(month)
  const monthQuery = useEvents({ page: 1, limit: SECTION_LIMIT, eventMonth })
  const listQuery = useEvents({ page: myEventPage, limit: MY_EVENT_LIMIT, mine: true })
  const deleteEvent = useDeleteEvent()

  const canUpdateEvent = can('event:update')
  const canDeleteEvent = can('event:delete')
  const canCreateEvent = can('event:create')
  // Error per-seksi: 403 → forbidden, selain itu loadData.
  const monthError = monthQuery.isError
    ? isForbiddenError(monthQuery.error)
      ? t('event:errors.forbidden')
      : t('event:errors.loadData')
    : undefined
  const listError = listQuery.isError
    ? isForbiddenError(listQuery.error)
      ? t('event:errors.forbidden')
      : t('event:errors.loadData')
    : undefined

  const listTotal = listQuery.data?.total ?? 0

  // Clamp pagination boundary setelah total berubah (mis. hapus item terakhir).
  useEffect(() => {
    if (listTotal > 0 && myEventPage > 1 && (myEventPage - 1) * MY_EVENT_LIMIT >= listTotal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMyEventPage(Math.max(1, Math.ceil(listTotal / MY_EVENT_LIMIT)))
    }
  }, [listTotal, myEventPage])

  function goCreate() {
    navigate('/events/new')
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
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('event:title')}</h1>
          <p className="text-sm text-muted-foreground">{t('event:subtitle')}</p>
        </div>
        {canCreateEvent && (
          <Button onClick={goCreate}>
            <Plus className="size-4" data-icon="inline-start" />
            {t('event:add')}
          </Button>
        )}
      </div>

      <EventMonthSection
        month={month}
        items={monthQuery.data?.items ?? []}
        isPending={monthQuery.isPending}
        errorMessage={monthError}
        onPrevMonth={() =>
          setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
        }
        onNextMonth={() =>
          setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
        }
        onCreate={canCreateEvent ? goCreate : undefined}
      />

      <MyEventList
        items={listQuery.data?.items ?? []}
        isPending={listQuery.isPending}
        errorMessage={listError}
        canUpdate={canUpdateEvent}
        canDelete={canDeleteEvent}
        onCreate={canCreateEvent ? goCreate : undefined}
        onDetail={(event) => navigate(`/events/${event.id}`)}
        onEdit={(event) => navigate(`/events/${event.id}/edit`)}
        onDelete={setDeletingEvent}
      />

      {!listError && (
        <DataTablePagination
          page={myEventPage}
          limit={MY_EVENT_LIMIT}
          total={listQuery.data?.total ?? 0}
          entityName={t('event:org.myTitle')}
          isPending={listQuery.isPending}
          onPrev={() => setMyEventPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setMyEventPage((prev) => prev + 1)}
        />
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
