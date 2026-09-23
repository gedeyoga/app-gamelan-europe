import { CalendarDays, Newspaper, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { PublishScheduleDialog } from '@/components/shared/publish-schedule-dialog'
import { DashboardArchiveCard } from '@/features/dashboard/components/dashboard-archive-card'
import { EventHighlightCard } from '@/components/shared/event-highlight-card'
import { DashboardHero } from '@/features/dashboard/components/dashboard-hero'
import { DashboardPendingArchives } from '@/features/dashboard/components/dashboard-pending-archives'
import { DashboardPendingEvents } from '@/features/dashboard/components/dashboard-pending-events'
import { DashboardSection } from '@/features/dashboard/components/dashboard-section'
import { DashboardCardSkeleton } from '@/features/dashboard/components/dashboard-skeletons'
import { DashboardStatCard } from '@/features/dashboard/components/dashboard-stat-card'
import { DashboardStoryCard } from '@/features/dashboard/components/dashboard-story-card'
import type {
  DashboardArchiveItem,
  DashboardEventItem,
  DashboardPendingArchiveItem,
  DashboardPendingEventItem,
  DashboardStoryItem,
} from '@/features/dashboard/types'
import { useAuth } from '@/features/auth/auth-provider'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { useApproveArchive } from '@/features/archive/hooks/use-approve-archive'
import { useArchives } from '@/features/archive/hooks/use-archives'
import { useRejectArchive } from '@/features/archive/hooks/use-reject-archive'
import { useApproveEvent } from '@/features/event/hooks/use-approve-event'
import { useEvents } from '@/features/event/hooks/use-events'
import { useRejectEvent } from '@/features/event/hooks/use-reject-event'
import { formatEventDate } from '@/features/event/lib/format'
import { useStories } from '@/features/story/hooks/use-stories'
import { useUsers } from '@/features/user/hooks/use-users'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'

const CARD_GRID_CLASS = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
const STATE_MESSAGE_CLASS =
  'rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground'
const MAX_ITEMS = 6
const PAGE = MAX_ITEMS
const PENDING_LIMIT = 5

export function DashboardHomePage() {
  const { t } = useTranslation('dashboard')
  const { user } = useAuth()
  const { canAny, can } = useAuthPermissions()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const roleName = user?.role?.name ?? ''
  const isAdmin = canAny(['event:approve', 'event:reject', 'event:publish', 'event:unpublish'])
  const isArchiveModerator = canAny(['archive:approve', 'archive:reject'])
  const canReadUsers = can('user:read')
  const canReadArchives = can('archive:read')
  const [storiesPage, setStoriesPage] = useState(1)
  const [archivesPage, setArchivesPage] = useState(1)
  const [eventsPage, setEventsPage] = useState(1)
  const [pendingEventsPage, setPendingEventsPage] = useState(1)
  const [pendingArchivesPage, setPendingArchivesPage] = useState(1)
  // Cutoff = awal hari ini UTC (bukan `Date.now()`) agar event "hari ini" tetap upcoming.
  // ponytail: cutoff diambil sekali per mount; upgrade ke live clock bila dashboard
  // harus tetap benar saat dibiarkan terbuka melewati tengah malam.
  const [now] = useState(() => {
    const d = new Date()
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  })

  // ponytail: sort tanggal event di client hanya benar di dalam 100 event PUBLISHED
  // pertama menurut `publishedAt`. Tambah sort tanggal di backend saat katalog > itu.
  const eventsQuery = useEvents({
    page: 1,
    limit: 100,
    filter: { status: 'PUBLISHED' },
    upcoming: true,
    sortBy: 'publishedAt',
    sortOrder: 'desc',
  })

  const storiesQuery = useStories({
    page: storiesPage,
    limit: MAX_ITEMS,
    filter: { status: 'PUBLISHED' },
    sortBy: 'publishedAt',
    sortOrder: 'desc',
  })

  const archivesQuery = useArchives({
    page: archivesPage,
    limit: MAX_ITEMS,
    filter: { status: 'PUBLISHED' },
    sortBy: 'publishedAt',
    sortOrder: 'desc',
    enabled: canReadArchives,
  })

  // Blok admin — hanya query bila `isAdmin` (tanpa nama role).
  const pendingQuery = useEvents({
    page: pendingEventsPage,
    limit: PENDING_LIMIT,
    filter: { status: 'REQUEST' },
    enabled: isAdmin,
  })
  // Blok moderator arsip — hanya query bila `isArchiveModerator`.
  const pendingArchivesQuery = useArchives({
    page: pendingArchivesPage,
    limit: PENDING_LIMIT,
    filter: { status: 'REQUEST' },
    enabled: isArchiveModerator,
  })
  const totalEventsQuery = useEvents({ page: 1, limit: 1, enabled: isAdmin })
  const totalStoriesQuery = useStories({ page: 1, limit: 1, enabled: isAdmin })
  const totalMembersQuery = useUsers({ page: 1, limit: 1, enabled: isAdmin && canReadUsers })

  const approveEvent = useApproveEvent()
  const rejectEvent = useRejectEvent()
  const approveArchive = useApproveArchive()
  const rejectArchive = useRejectArchive()
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null)
  const [archiveApproveTargetId, setArchiveApproveTargetId] = useState<string | null>(null)

  const busyId = approveEvent.isPending
    ? approveEvent.variables?.id
    : rejectEvent.isPending
      ? rejectEvent.variables
      : undefined

  const archiveBusyId = approveArchive.isPending
    ? approveArchive.variables?.id
    : rejectArchive.isPending
      ? rejectArchive.variables
      : undefined

  // Nilai kartu statistik admin: `…` saat memuat, `—` saat gagal, angka setelah ada data.
  const statValue = (query: {
    isPending: boolean
    isError: boolean
    data?: { total: number }
  }): number | string =>
    query.isPending ? '…' : query.isError ? '—' : (query.data?.total ?? 0)

  // Ambil tanggal terdekat (>= cutoff UTC) tiap event, buang yang tanpa tanggal
  // mendatang, urut naik, ambil 6 teratas. Format di route (boleh import fitur event).
  const events = useMemo<DashboardEventItem[]>(() => {
    const items: { item: DashboardEventItem; time: number }[] = []

    for (const event of eventsQuery.data?.items ?? []) {
      const upcomingDate = event.dates
        .filter((date) => {
          const time = new Date(date.date).getTime()
          return !Number.isNaN(time) && time >= now
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]

      if (!upcomingDate) continue

      items.push({
        item: {
          id: event.id,
          name: event.name,
          thumbnail: event.thumbnail,
          dateLabel: formatEventDate(upcomingDate),
          date: upcomingDate.date,
          locationName: event.location?.name ?? null,
          eventTypes: event.eventTypes.map((eventType) => eventType.name),
        },
        time: new Date(upcomingDate.date).getTime(),
      })
    }

    return items
      .sort((a, b) => a.time - b.time)
      .map(({ item }) => item)
  }, [eventsQuery.data, now])

  const stories = useMemo<DashboardStoryItem[]>(
    () =>
      (storiesQuery.data?.items ?? []).map((story) => ({
        id: story.id,
        name: story.name,
        thumbnail: story.thumbnail,
        categories: story.categories.map((category) => category.name),
        authorName: story.creator?.fullName ?? null,
        publishedAt: story.publishedAt,
      })),
    [storiesQuery.data],
  )

  const archives = useMemo<DashboardArchiveItem[]>(
    () =>
      (archivesQuery.data?.items ?? []).map((archive) => ({
        id: archive.id,
        name: archive.name,
        thumbnail: archive.thumbnail,
        description: archive.description ?? null,
        categories: archive.categories.map((category) => category.name),
        type: archive.type,
        publishedAt: archive.publishedAt,
      })),
    [archivesQuery.data],
  )

  const pendingEvents = useMemo<DashboardPendingEventItem[]>(
    () =>
      (pendingQuery.data?.items ?? []).map((event) => ({
        id: event.id,
        name: event.name,
        thumbnail: event.thumbnail,
        creatorName: event.creator?.organization?.name ?? event.creator?.fullName ?? null,
        dateLabel: event.dates[0] ? formatEventDate(event.dates[0]) : null,
      })),
    [pendingQuery.data],
  )

  const pendingArchives = useMemo<DashboardPendingArchiveItem[]>(
    () =>
      (pendingArchivesQuery.data?.items ?? []).map((archive) => ({
        id: archive.id,
        name: archive.name,
        thumbnail: archive.thumbnail,
        creatorName: archive.creator?.fullName ?? null,
        description: archive.description ?? null,
        categories: archive.categories.map((category) => category.name),
      })),
    [pendingArchivesQuery.data],
  )

  const eventsTotalPages = Math.max(1, Math.ceil(events.length / PAGE))
  const pendingEventsTotal = pendingQuery.data?.total ?? 0
  const pendingEventsPages = Math.max(1, Math.ceil(pendingEventsTotal / PENDING_LIMIT))
  const pendingArchivesTotal = pendingArchivesQuery.data?.total ?? 0
  const pendingArchivesPages = Math.max(1, Math.ceil(pendingArchivesTotal / PENDING_LIMIT))

  // Clamp boundary halaman klien bila daftar menyusut (mis. approve/reject item terakhir).
  useEffect(() => {
    if (eventsPage > eventsTotalPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventsPage(eventsTotalPages)
    }
  }, [eventsPage, eventsTotalPages])

  useEffect(() => {
    if (pendingEventsPage > pendingEventsPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingEventsPage(pendingEventsPages)
    }
  }, [pendingEventsPage, pendingEventsPages])

  useEffect(() => {
    if (pendingArchivesPage > pendingArchivesPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingArchivesPage(pendingArchivesPages)
    }
  }, [pendingArchivesPage, pendingArchivesPages])

  function handleConfirmApprove(publishedAt: string) {
    if (!approveTargetId) return
    approveEvent.mutate(
      { id: approveTargetId, publishedAt },
      {
        onSuccess: () => {
          setApproveTargetId(null)
          toastSuccess(t('event:toast.approved'))
        },
      onError: (err: unknown) => {
        setApproveTargetId(null)
        void queryClient.invalidateQueries({ queryKey: ['event'] })
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('event:toast.approveFailed')))
      },
      },
    )
  }

  function handleReject(id: string) {
    rejectEvent.mutate(id, {
      onSuccess: () => toastSuccess(t('event:toast.rejected')),
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('event:toast.rejectFailed')))
      },
    })
  }

  function handleConfirmArchiveApprove(publishedAt: string) {
    if (!archiveApproveTargetId) return
    approveArchive.mutate(
      { id: archiveApproveTargetId, publishedAt },
      {
        onSuccess: () => {
          setArchiveApproveTargetId(null)
          toastSuccess(t('archive:toast.approved'))
        },
        onError: (err: unknown) => {
          setArchiveApproveTargetId(null)
          void queryClient.invalidateQueries({ queryKey: ['archive'] })
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('archive:toast.approveFailed')))
        },
      },
    )
  }

  function handleRejectArchive(id: string) {
    rejectArchive.mutate(id, {
      onSuccess: () => toastSuccess(t('archive:toast.rejected')),
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('archive:toast.rejectFailed')))
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <DashboardHero fullName={user?.fullName ?? ''} roleName={roleName} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isAdmin ? (
          <>
            <DashboardStatCard
              icon={CalendarDays}
              label={t('stats.totalEvents')}
              value={statValue(totalEventsQuery)}
            />
            <DashboardStatCard
              icon={Newspaper}
              label={t('stats.totalStories')}
              value={statValue(totalStoriesQuery)}
            />
            {canReadUsers && (
              <DashboardStatCard
                icon={Users}
                label={t('stats.totalMembers')}
                value={statValue(totalMembersQuery)}
              />
            )}
          </>
        ) : (
          <>
            <DashboardStatCard
              icon={CalendarDays}
              label={t('stats.upcomingEvents')}
              value={eventsQuery.data?.total ?? 0}
            />
            <DashboardStatCard
              icon={Newspaper}
              label={t('stats.publishedStories')}
              value={storiesQuery.data?.total ?? 0}
            />
          </>
        )}
      </div>

      {isAdmin && (
        <DashboardSection
          title={t('section.pendingEvents.title')}
          subtitle={t('section.pendingEvents.subtitle')}
        >
          <DashboardPendingEvents
            items={pendingEvents}
            isPending={pendingQuery.isPending}
            isError={pendingQuery.isError}
            canApprove={can('event:approve')}
            canReject={can('event:reject')}
            isRefreshing={pendingQuery.isFetching}
            onViewDetail={(id) => navigate(`/events/${id}`)}
            onApprove={setApproveTargetId}
            onReject={handleReject}
            busyId={busyId}
          />
          {!pendingQuery.isError && !pendingQuery.isPending && pendingEventsTotal > 0 && (
            <DataTablePagination
              page={pendingEventsPage}
              limit={PENDING_LIMIT}
              total={pendingEventsTotal}
              entityName={t('section.pendingEvents.title')}
              isPending={pendingQuery.isFetching}
              onPrev={() => setPendingEventsPage((page) => Math.max(1, page - 1))}
              onNext={() => setPendingEventsPage((page) => page + 1)}
            />
          )}
        </DashboardSection>
      )}

      {isArchiveModerator && (
        <DashboardSection
          title={t('section.pendingArchives.title')}
          subtitle={t('section.pendingArchives.subtitle')}
        >
          <DashboardPendingArchives
            items={pendingArchives}
            isPending={pendingArchivesQuery.isPending}
            isError={pendingArchivesQuery.isError}
            canApprove={can('archive:approve')}
            canReject={can('archive:reject')}
            isRefreshing={pendingArchivesQuery.isFetching}
            onViewDetail={(id) => navigate(`/archives/${id}`)}
            onApprove={setArchiveApproveTargetId}
            onReject={handleRejectArchive}
            busyId={archiveBusyId}
          />
          {!pendingArchivesQuery.isError &&
            !pendingArchivesQuery.isPending &&
            pendingArchivesTotal > 0 && (
              <DataTablePagination
                page={pendingArchivesPage}
                limit={PENDING_LIMIT}
                total={pendingArchivesTotal}
                entityName={t('section.pendingArchives.title')}
                isPending={pendingArchivesQuery.isFetching}
                onPrev={() => setPendingArchivesPage((page) => Math.max(1, page - 1))}
                onNext={() => setPendingArchivesPage((page) => page + 1)}
              />
            )}
        </DashboardSection>
      )}

      {!isAdmin && (
        <DashboardSection
          title={t('section.upcomingEvents.title')}
          subtitle={t('section.upcomingEvents.subtitle')}
          empty={
            !eventsQuery.isPending && events.length === 0 ? (
              <p className={STATE_MESSAGE_CLASS}>
                {eventsQuery.isError
                  ? t('section.upcomingEvents.error')
                  : t('section.upcomingEvents.empty')}
              </p>
            ) : undefined
          }
        >
          <div className={CARD_GRID_CLASS}>
            {eventsQuery.isPending
              ? Array.from({ length: 3 }).map((_, index) => <DashboardCardSkeleton key={index} />)
              : events
                  .slice((eventsPage - 1) * PAGE, eventsPage * PAGE)
                  .map((event) => (
                    <EventHighlightCard
                      key={event.id}
                      id={event.id}
                      name={event.name}
                      thumbnail={event.thumbnail}
                      date={event.date}
                      locationName={event.locationName}
                      eventTypes={event.eventTypes}
                    />
                  ))}
          </div>
          {!eventsQuery.isError && !eventsQuery.isPending && events.length > 0 && (
            <DataTablePagination
              page={eventsPage}
              limit={PAGE}
              total={events.length}
              entityName={t('section.upcomingEvents.title')}
              isPending={eventsQuery.isFetching}
              onPrev={() => setEventsPage((page) => Math.max(1, page - 1))}
              onNext={() => setEventsPage((page) => page + 1)}
            />
          )}
        </DashboardSection>
      )}

      {!isAdmin && (
        <DashboardSection
          title={t('section.stories.title')}
          subtitle={t('section.stories.subtitle')}
          empty={
            !storiesQuery.isPending && stories.length === 0 ? (
              <p className={STATE_MESSAGE_CLASS}>
                {storiesQuery.isError
                  ? t('section.stories.error')
                  : t('section.stories.empty')}
              </p>
            ) : undefined
          }
        >
          <div className={CARD_GRID_CLASS}>
            {storiesQuery.isPending
              ? Array.from({ length: 3 }).map((_, index) => <DashboardCardSkeleton key={index} />)
              : stories.map((story) => <DashboardStoryCard key={story.id} story={story} />)}
          </div>
          {!storiesQuery.isError && !storiesQuery.isPending && stories.length > 0 && (
            <DataTablePagination
              page={storiesPage}
              limit={MAX_ITEMS}
              total={storiesQuery.data?.total ?? 0}
              entityName={t('section.stories.title')}
              isPending={storiesQuery.isFetching}
              onPrev={() => setStoriesPage((page) => Math.max(1, page - 1))}
              onNext={() => setStoriesPage((page) => page + 1)}
            />
          )}
        </DashboardSection>
      )}

      {!isAdmin && canReadArchives && (
        <DashboardSection
          title={t('section.archives.title')}
          subtitle={t('section.archives.subtitle')}
          empty={
            !archivesQuery.isPending && archives.length === 0 ? (
              <p className={STATE_MESSAGE_CLASS}>
                {archivesQuery.isError
                  ? t('section.archives.error')
                  : t('section.archives.empty')}
              </p>
            ) : undefined
          }
        >
          <div className={CARD_GRID_CLASS}>
            {archivesQuery.isPending
              ? Array.from({ length: 3 }).map((_, index) => <DashboardCardSkeleton key={index} />)
              : archives.map((archive) => (
                  <DashboardArchiveCard key={archive.id} archive={archive} />
                ))}
          </div>
          {!archivesQuery.isError && !archivesQuery.isPending && archives.length > 0 && (
            <DataTablePagination
              page={archivesPage}
              limit={MAX_ITEMS}
              total={archivesQuery.data?.total ?? 0}
              entityName={t('section.archives.title')}
              isPending={archivesQuery.isFetching}
              onPrev={() => setArchivesPage((page) => Math.max(1, page - 1))}
              onNext={() => setArchivesPage((page) => page + 1)}
            />
          )}
        </DashboardSection>
      )}

      <PublishScheduleDialog
        open={approveTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setApproveTargetId(null)
        }}
        onConfirm={handleConfirmApprove}
        isPending={approveEvent.isPending}
        title={t('event:publishDialog.title')}
        description={t('event:publishDialog.description')}
        dateLabel={t('event:publishDialog.dateLabel')}
        datePlaceholder={t('event:publishDialog.datePlaceholder')}
        nextLabel={t('event:confirm.submit')}
        confirmTitle={t('event:confirm.title')}
        confirmDescription={t('event:publishDialog.confirmDescription')}
        confirmLabel={t('event:workflow.approve')}
        cancelLabel={t('common:actions.cancel')}
      />

      <PublishScheduleDialog
        open={archiveApproveTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveApproveTargetId(null)
        }}
        onConfirm={handleConfirmArchiveApprove}
        isPending={approveArchive.isPending}
        title={t('archive:publishDialog.title')}
        description={t('archive:publishDialog.description')}
        dateLabel={t('archive:publishDialog.dateLabel')}
        datePlaceholder={t('archive:publishDialog.datePlaceholder')}
        nextLabel={t('archive:confirm.submit')}
        confirmTitle={t('archive:confirm.title')}
        confirmDescription={t('archive:publishDialog.confirmDescription')}
        confirmLabel={t('archive:workflow.approve')}
        cancelLabel={t('common:actions.cancel')}
      />
    </div>
  )
}
