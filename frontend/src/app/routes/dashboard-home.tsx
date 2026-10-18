import { CalendarDays, Newspaper, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { PublishScheduleDialog } from '@/components/shared/publish-schedule-dialog'
import { DashboardArchiveCard } from '@/features/dashboard/components/dashboard-archive-card'
import { DashboardApprovalColumn } from '@/features/dashboard/components/dashboard-approval-column'
import { EventHighlightCard } from '@/components/shared/event-highlight-card'
import { DashboardHero } from '@/features/dashboard/components/dashboard-hero'
import { DashboardPendingArchives } from '@/features/dashboard/components/dashboard-pending-archives'
import { DashboardPendingNetworkSubmissions } from '@/features/dashboard/components/dashboard-pending-network-submissions'
import { DashboardPendingSubscriptionRequests } from '@/features/dashboard/components/dashboard-pending-subscription-requests'
import { DashboardPendingStories } from '@/features/dashboard/components/dashboard-pending-stories'
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
  DashboardPendingNetworkSubmissionItem,
  DashboardPendingStoryItem,
  DashboardPendingSubscriptionRequestItem,
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
import { useApproveNetwork } from '@/features/network/hooks/use-approve-network'
import { useNetworks } from '@/features/network/hooks/use-networks'
import { useRejectNetwork } from '@/features/network/hooks/use-reject-network'
import { useUploadPaymentProof } from '@/features/billing/hooks/use-upload-payment-proof'
import type { PaymentProof } from '@/features/billing/types'
import { ApproveSubscriptionRequestDialog } from '@/features/subscription-request/components/approve-subscription-request-dialog'
import { RejectSubscriptionRequestDialog } from '@/features/subscription-request/components/reject-subscription-request-dialog'
import { useApproveSubscriptionRequest } from '@/features/subscription-request/hooks/use-approve-subscription-request'
import { useRejectSubscriptionRequest } from '@/features/subscription-request/hooks/use-reject-subscription-request'
import { useSubscriptionRequests } from '@/features/subscription-request/hooks/use-subscription-requests'
import type { SubscriptionRequest } from '@/features/subscription-request/types'
import { useStories } from '@/features/story/hooks/use-stories'
import { useApproveStory } from '@/features/story/hooks/use-approve-story'
import { useRejectStory } from '@/features/story/hooks/use-reject-story'
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
  const isStoryModerator = canAny(['story:approve', 'story:reject'])
  const canReadNetworks = can('network:read')
  const canReadUsers = can('user:read')
  const canReadArchives = can('archive:read')
  const canReadSubscriptionRequests = can('subscription-request:read')
  const [storiesPage, setStoriesPage] = useState(1)
  const [archivesPage, setArchivesPage] = useState(1)
  const [eventsPage, setEventsPage] = useState(1)
  const [pendingEventsPage, setPendingEventsPage] = useState(1)
  const [pendingArchivesPage, setPendingArchivesPage] = useState(1)
  const [pendingStoriesPage, setPendingStoriesPage] = useState(1)
  const [pendingNetworkSubmissionsPage, setPendingNetworkSubmissionsPage] = useState(1)
  const [pendingSubscriptionRequestsPage, setPendingSubscriptionRequestsPage] = useState(1)
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
  const pendingStoriesQuery = useStories({
    page: pendingStoriesPage,
    limit: PENDING_LIMIT,
    filter: { status: 'REQUEST' },
    enabled: isStoryModerator,
  })
  const pendingNetworkSubmissionsQuery = useNetworks({
    page: pendingNetworkSubmissionsPage,
    limit: PENDING_LIMIT,
    filter: { status: 'REQUEST' },
    enabled: canReadNetworks,
  })
  const pendingSubscriptionRequestsQuery = useSubscriptionRequests({
    page: pendingSubscriptionRequestsPage,
    limit: PENDING_LIMIT,
    filter: { status: 'PENDING' },
    enabled: canReadSubscriptionRequests,
  })
  const totalEventsQuery = useEvents({ page: 1, limit: 1, enabled: isAdmin })
  const totalStoriesQuery = useStories({ page: 1, limit: 1, enabled: isAdmin })
  const totalMembersQuery = useUsers({ page: 1, limit: 1, enabled: isAdmin && canReadUsers })

  const approveEvent = useApproveEvent()
  const rejectEvent = useRejectEvent()
  const approveArchive = useApproveArchive()
  const rejectArchive = useRejectArchive()
  const approveStory = useApproveStory()
  const rejectStory = useRejectStory()
  const approveNetwork = useApproveNetwork()
  const rejectNetwork = useRejectNetwork()
  const approveSubscriptionRequest = useApproveSubscriptionRequest()
  const rejectSubscriptionRequest = useRejectSubscriptionRequest()
  const uploadPaymentProof = useUploadPaymentProof()
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null)
  const [archiveApproveTargetId, setArchiveApproveTargetId] = useState<string | null>(null)
  const [storyApproveTargetId, setStoryApproveTargetId] = useState<string | null>(null)
  const [networkApproveTargetId, setNetworkApproveTargetId] = useState<string | null>(null)
  const [subscriptionRequestApproveTarget, setSubscriptionRequestApproveTarget] =
    useState<SubscriptionRequest | null>(null)
  const [subscriptionRequestRejectTarget, setSubscriptionRequestRejectTarget] =
    useState<SubscriptionRequest | null>(null)
  const [paymentProof, setPaymentProof] = useState<PaymentProof | null>(null)

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

  const storyBusyId = approveStory.isPending
    ? approveStory.variables?.id
    : rejectStory.isPending
      ? rejectStory.variables
      : undefined

  const networkSubmissionBusyId = approveNetwork.isPending
    ? approveNetwork.variables?.id
    : rejectNetwork.isPending
      ? rejectNetwork.variables
      : undefined

  const subscriptionRequestBusyId = approveSubscriptionRequest.isPending
    ? approveSubscriptionRequest.variables?.id
    : rejectSubscriptionRequest.isPending
      ? rejectSubscriptionRequest.variables?.id
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
        creatorName: event.network?.name ?? event.creator?.fullName ?? null,
        locationName: event.location?.name ?? null,
        dateLabel: event.dates[0] ? formatEventDate(event.dates[0]) : null,
        source: event.source,
        publishedAt: event.publishedAt,
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
        publishedAt: archive.publishedAt,
      })),
    [pendingArchivesQuery.data],
  )

  const pendingStories = useMemo<DashboardPendingStoryItem[]>(
    () =>
      (pendingStoriesQuery.data?.items ?? []).map((story) => ({
        id: story.id,
        name: story.name,
        thumbnail: story.thumbnail,
        creatorName: story.creator?.fullName ?? null,
        categories: story.categories.map((category) => category.name),
        source: story.source,
        publishedAt: story.publishedAt,
      })),
    [pendingStoriesQuery.data],
  )

  const pendingNetworkSubmissions = useMemo<DashboardPendingNetworkSubmissionItem[]>(
    () =>
      (pendingNetworkSubmissionsQuery.data?.items ?? []).map((network) => ({
        id: network.id,
        name: network.name,
        organisationType: network.organisationType ?? null,
        country: network.country ?? null,
        state: network.state ?? null,
        contact: network.contact ?? null,
      })),
    [pendingNetworkSubmissionsQuery.data],
  )

  const pendingSubscriptionRequests = useMemo<DashboardPendingSubscriptionRequestItem[]>(
    () =>
      (pendingSubscriptionRequestsQuery.data?.items ?? []).map((request) => ({
        id: request.id,
        fullName: request.fullName,
        email: request.email,
        planName: request.subscription.name,
        requestType: request.requestType,
        createdAt: request.createdAt,
      })),
    [pendingSubscriptionRequestsQuery.data],
  )

  const eventsTotalPages = Math.max(1, Math.ceil(events.length / PAGE))
  const pendingEventsTotal = pendingQuery.data?.total ?? 0
  const pendingEventsPages = Math.max(1, Math.ceil(pendingEventsTotal / PENDING_LIMIT))
  const pendingArchivesTotal = pendingArchivesQuery.data?.total ?? 0
  const pendingArchivesPages = Math.max(1, Math.ceil(pendingArchivesTotal / PENDING_LIMIT))
  const pendingStoriesTotal = pendingStoriesQuery.data?.total ?? 0
  const pendingStoriesPages = Math.max(1, Math.ceil(pendingStoriesTotal / PENDING_LIMIT))
  const pendingNetworkSubmissionsTotal = pendingNetworkSubmissionsQuery.data?.total ?? 0
  const pendingNetworkSubmissionsPages = Math.max(
    1,
    Math.ceil(pendingNetworkSubmissionsTotal / PENDING_LIMIT),
  )
  const pendingSubscriptionRequestsTotal = pendingSubscriptionRequestsQuery.data?.total ?? 0
  const pendingSubscriptionRequestsPages = Math.max(
    1,
    Math.ceil(pendingSubscriptionRequestsTotal / PENDING_LIMIT),
  )

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

  useEffect(() => {
    if (pendingStoriesPage > pendingStoriesPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingStoriesPage(pendingStoriesPages)
    }
  }, [pendingStoriesPage, pendingStoriesPages])

  useEffect(() => {
    if (pendingNetworkSubmissionsPage > pendingNetworkSubmissionsPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingNetworkSubmissionsPage(pendingNetworkSubmissionsPages)
    }
  }, [pendingNetworkSubmissionsPage, pendingNetworkSubmissionsPages])

  useEffect(() => {
    if (pendingSubscriptionRequestsPage > pendingSubscriptionRequestsPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingSubscriptionRequestsPage(pendingSubscriptionRequestsPages)
    }
  }, [pendingSubscriptionRequestsPage, pendingSubscriptionRequestsPages])

  // Satu jalur approve per entitas: dipakai dialog jadwal maupun approve langsung
  // (record sudah punya `publishedAt`) supaya toast/error tidak terduplikasi.
  function approveEventNow(id: string, publishedAt: string, notify?: boolean) {
    approveEvent.mutate(
      { id, publishedAt, notify },
      {
        onSuccess: () => toastSuccess(t('event:toast.approved')),
        onError: (err: unknown) => {
          void queryClient.invalidateQueries({ queryKey: ['event'] })
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('event:toast.approveFailed')))
        },
      },
    )
  }

  function handleApproveEvent(id: string, publishedAt: string | null) {
    if (publishedAt) {
      approveEventNow(id, publishedAt)
      return
    }
    setApproveTargetId(id)
  }

  function handleConfirmApprove(publishedAt: string, notify: boolean) {
    if (!approveTargetId) return
    setApproveTargetId(null)
    approveEventNow(approveTargetId, publishedAt, notify)
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

  function approveArchiveNow(id: string, publishedAt: string, notify?: boolean) {
    approveArchive.mutate(
      { id, publishedAt, notify },
      {
        onSuccess: () => toastSuccess(t('archive:toast.approved')),
        onError: (err: unknown) => {
          void queryClient.invalidateQueries({ queryKey: ['archive'] })
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('archive:toast.approveFailed')))
        },
      },
    )
  }

  function handleApproveArchive(id: string, publishedAt: string | null) {
    if (publishedAt) {
      approveArchiveNow(id, publishedAt)
      return
    }
    setArchiveApproveTargetId(id)
  }

  function handleConfirmArchiveApprove(publishedAt: string, notify: boolean) {
    if (!archiveApproveTargetId) return
    setArchiveApproveTargetId(null)
    approveArchiveNow(archiveApproveTargetId, publishedAt, notify)
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

  function approveStoryNow(id: string, publishedAt: string, notify?: boolean) {
    approveStory.mutate(
      { id, publishedAt, notify },
      {
        onSuccess: () => toastSuccess(t('story:toast.approved')),
        onError: (err: unknown) => {
          void queryClient.invalidateQueries({ queryKey: ['story'] })
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('story:toast.approveFailed')))
        },
      },
    )
  }

  function handleApproveStory(id: string, publishedAt: string | null) {
    if (publishedAt) {
      approveStoryNow(id, publishedAt)
      return
    }
    setStoryApproveTargetId(id)
  }

  function handleConfirmStoryApprove(publishedAt: string, notify: boolean) {
    if (!storyApproveTargetId) return
    setStoryApproveTargetId(null)
    approveStoryNow(storyApproveTargetId, publishedAt, notify)
  }

  function handleRejectStory(id: string) {
    rejectStory.mutate(id, {
      onSuccess: () => toastSuccess(t('story:toast.rejected')),
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('story:toast.rejectFailed')))
      },
    })
  }

  function handleApproveNetwork(id: string) {
    setNetworkApproveTargetId(id)
  }

  function handleConfirmNetworkApprove(publishedAt: string) {
    if (!networkApproveTargetId) return
    setNetworkApproveTargetId(null)
    approveNetwork.mutate(
      { id: networkApproveTargetId, publishedAt },
      {
        onSuccess: () => toastSuccess(t('network:toast.approved')),
        onError: (err: unknown) => {
          void queryClient.invalidateQueries({ queryKey: ['network'] })
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('network:toast.approveFailed')))
        },
      },
    )
  }

  function handleRejectNetwork(id: string) {
    rejectNetwork.mutate(id, {
      onSuccess: () => toastSuccess(t('network:toast.rejected')),
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('network:toast.rejectFailed')))
      },
    })
  }

  function findSubscriptionRequest(id: string): SubscriptionRequest | null {
    return (
      pendingSubscriptionRequestsQuery.data?.items.find((request) => request.id === id) ?? null
    )
  }

  function handleApproveSubscriptionRequest() {
    if (!subscriptionRequestApproveTarget) return
    approveSubscriptionRequest.mutate(
      {
        id: subscriptionRequestApproveTarget.id,
        ...(paymentProof
          ? { paymentProofUrl: paymentProof.url, paymentProofName: paymentProof.filename }
          : {}),
      },
      {
        onSuccess: () => {
          closeSubscriptionRequestApprove()
          toastSuccess(t('subscriptionRequest:toast.approved'))
        },
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('subscriptionRequest:toast.approveFailed')))
        },
      },
    )
  }

  function openSubscriptionRequestApprove(id: string) {
    setPaymentProof(null)
    uploadPaymentProof.reset()
    setSubscriptionRequestApproveTarget(findSubscriptionRequest(id))
  }

  function closeSubscriptionRequestApprove() {
    setSubscriptionRequestApproveTarget(null)
    setPaymentProof(null)
    uploadPaymentProof.reset()
  }

  function handleSelectProof(file: File) {
    uploadPaymentProof.mutate(file, { onSuccess: setPaymentProof })
  }

  function handleRejectSubscriptionRequest(note: string) {
    if (!subscriptionRequestRejectTarget) return
    rejectSubscriptionRequest.mutate(
      { id: subscriptionRequestRejectTarget.id, note: note || undefined },
      {
        onSuccess: () => {
          setSubscriptionRequestRejectTarget(null)
          toastSuccess(t('subscriptionRequest:toast.rejected'))
        },
        onError: (err: unknown) => {
          if (isValidationError(err)) return
          toastError(getApiErrorMessage(err, t('subscriptionRequest:toast.rejectFailed')))
        },
      },
    )
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

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {isAdmin && (
          <DashboardSection
            title={t('section.pendingEvents.title')}
            subtitle={t('section.pendingEvents.subtitle')}
          >
            <div className="flex flex-col gap-3">
              <DashboardPendingEvents
                items={pendingEvents}
                isPending={pendingQuery.isPending}
                isError={pendingQuery.isError}
                canApprove={can('event:approve')}
                canReject={can('event:reject')}
                canUpdate={can('event:update')}
                isRefreshing={pendingQuery.isFetching}
                onEdit={(id) => navigate(`/events/${id}/edit`)}
                onApprove={handleApproveEvent}
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
            </div>
          </DashboardSection>
        )}

        {isStoryModerator && (
          <DashboardSection
            title={t('section.pendingStories.title')}
            subtitle={t('section.pendingStories.subtitle')}
          >
            <div className="flex flex-col gap-3">
              <DashboardPendingStories
                items={pendingStories}
                isPending={pendingStoriesQuery.isPending}
                isError={pendingStoriesQuery.isError}
                canApprove={can('story:approve')}
                canReject={can('story:reject')}
                canUpdate={can('story:update')}
                isRefreshing={pendingStoriesQuery.isFetching}
                onEdit={(id) => navigate(`/stories/${id}/edit`)}
                onApprove={handleApproveStory}
                onReject={handleRejectStory}
                busyId={storyBusyId}
              />
              {!pendingStoriesQuery.isError &&
                !pendingStoriesQuery.isPending &&
                pendingStoriesTotal > 0 && (
                  <DataTablePagination
                    page={pendingStoriesPage}
                    limit={PENDING_LIMIT}
                    total={pendingStoriesTotal}
                    entityName={t('section.pendingStories.title')}
                    isPending={pendingStoriesQuery.isFetching}
                    onPrev={() => setPendingStoriesPage((page) => Math.max(1, page - 1))}
                    onNext={() => setPendingStoriesPage((page) => page + 1)}
                  />
                )}
            </div>
          </DashboardSection>
        )}
      </div>

      {isArchiveModerator && (
        <DashboardSection
          title={t('section.pendingArchives.title')}
          subtitle={t('section.pendingArchives.subtitle')}
        >
          <DashboardApprovalColumn title={t('column.member')}>
            <DashboardPendingArchives
              items={pendingArchives}
              isPending={pendingArchivesQuery.isPending}
              isError={pendingArchivesQuery.isError}
              canApprove={can('archive:approve')}
              canReject={can('archive:reject')}
              canUpdate={can('archive:update')}
              isRefreshing={pendingArchivesQuery.isFetching}
              onEdit={(id) => navigate(`/archives/${id}/edit`)}
              onApprove={handleApproveArchive}
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
                  entityName={t('column.member')}
                  isPending={pendingArchivesQuery.isFetching}
                  onPrev={() => setPendingArchivesPage((page) => Math.max(1, page - 1))}
                  onNext={() => setPendingArchivesPage((page) => page + 1)}
                />
              )}
          </DashboardApprovalColumn>
        </DashboardSection>
      )}

      {canReadNetworks && (
        <DashboardSection
          title={t('section.pendingNetworkSubmissions.title')}
          subtitle={t('section.pendingNetworkSubmissions.subtitle')}
        >
          <div className="flex flex-col gap-3">
            <DashboardPendingNetworkSubmissions
              items={pendingNetworkSubmissions}
              isPending={pendingNetworkSubmissionsQuery.isPending}
              isError={pendingNetworkSubmissionsQuery.isError}
              canApprove={can('network:approve')}
              canReject={can('network:reject')}
              canUpdate={can('network:update')}
              isRefreshing={pendingNetworkSubmissionsQuery.isFetching}
              onEdit={(id) => navigate(`/networks/${id}/edit`)}
              onApprove={handleApproveNetwork}
              onReject={handleRejectNetwork}
              busyId={networkSubmissionBusyId}
            />
            {!pendingNetworkSubmissionsQuery.isError &&
              !pendingNetworkSubmissionsQuery.isPending &&
              pendingNetworkSubmissionsTotal > 0 && (
                <DataTablePagination
                  page={pendingNetworkSubmissionsPage}
                  limit={PENDING_LIMIT}
                  total={pendingNetworkSubmissionsTotal}
                  entityName={t('section.pendingNetworkSubmissions.title')}
                  isPending={pendingNetworkSubmissionsQuery.isFetching}
                  onPrev={() =>
                    setPendingNetworkSubmissionsPage((page) => Math.max(1, page - 1))
                  }
                  onNext={() => setPendingNetworkSubmissionsPage((page) => page + 1)}
                />
              )}
          </div>
        </DashboardSection>
      )}

      {canReadSubscriptionRequests && (
        <DashboardSection
          title={t('section.pendingSubscriptionRequests.title')}
          subtitle={t('section.pendingSubscriptionRequests.subtitle')}
        >
          <div className="flex flex-col gap-3">
            <DashboardPendingSubscriptionRequests
              items={pendingSubscriptionRequests}
              isPending={pendingSubscriptionRequestsQuery.isPending}
              isError={pendingSubscriptionRequestsQuery.isError}
              canApprove={can('subscription-request:approve')}
              canReject={can('subscription-request:reject')}
              isRefreshing={pendingSubscriptionRequestsQuery.isFetching}
              onView={(id) => navigate(`/subscription-requests/${id}`)}
              onApprove={openSubscriptionRequestApprove}
              onReject={(id) => setSubscriptionRequestRejectTarget(findSubscriptionRequest(id))}
              busyId={subscriptionRequestBusyId}
            />
            {!pendingSubscriptionRequestsQuery.isError &&
              !pendingSubscriptionRequestsQuery.isPending &&
              pendingSubscriptionRequestsTotal > 0 && (
                <DataTablePagination
                  page={pendingSubscriptionRequestsPage}
                  limit={PENDING_LIMIT}
                  total={pendingSubscriptionRequestsTotal}
                  entityName={t('section.pendingSubscriptionRequests.title')}
                  isPending={pendingSubscriptionRequestsQuery.isFetching}
                  onPrev={() =>
                    setPendingSubscriptionRequestsPage((page) => Math.max(1, page - 1))
                  }
                  onNext={() => setPendingSubscriptionRequestsPage((page) => page + 1)}
                />
              )}
          </div>
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
        confirmLabel={t('event:workflow.approve')}
        cancelLabel={t('common:actions.cancel')}
        notifyLabel={t('event:publishDialog.notifyLabel')}
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
        confirmLabel={t('archive:workflow.approve')}
        cancelLabel={t('common:actions.cancel')}
        notifyLabel={t('archive:publishDialog.notifyLabel')}
      />

      <PublishScheduleDialog
        open={storyApproveTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setStoryApproveTargetId(null)
        }}
        onConfirm={handleConfirmStoryApprove}
        isPending={approveStory.isPending}
        title={t('story:publishDialog.title')}
        description={t('story:publishDialog.description')}
        dateLabel={t('story:publishDialog.dateLabel')}
        datePlaceholder={t('story:publishDialog.datePlaceholder')}
        confirmLabel={t('story:workflow.approve')}
        cancelLabel={t('common:actions.cancel')}
        notifyLabel={t('story:publishDialog.notifyLabel')}
      />

      <PublishScheduleDialog
        open={networkApproveTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setNetworkApproveTargetId(null)
        }}
        onConfirm={handleConfirmNetworkApprove}
        isPending={approveNetwork.isPending}
        title={t('network:publishDialog.title')}
        description={t('network:publishDialog.description')}
        dateLabel={t('network:publishDialog.dateLabel')}
        datePlaceholder={t('network:publishDialog.datePlaceholder')}
        confirmLabel={t('network:publishDialog.confirm')}
        cancelLabel={t('common:actions.cancel')}
      />

      {subscriptionRequestApproveTarget && (
        <ApproveSubscriptionRequestDialog
          name={subscriptionRequestApproveTarget.fullName}
          isSubmitting={approveSubscriptionRequest.isPending}
          paymentProof={paymentProof}
          isUploadingProof={uploadPaymentProof.isPending}
          proofError={
            uploadPaymentProof.error
              ? getApiErrorMessage(
                  uploadPaymentProof.error,
                  t('subscriptionRequest:approveDialog.proofFailed'),
                )
              : null
          }
          onSelectProof={handleSelectProof}
          onRemoveProof={() => {
            setPaymentProof(null)
            uploadPaymentProof.reset()
          }}
          onConfirm={handleApproveSubscriptionRequest}
          onOpenChange={(open) => {
            if (!open) closeSubscriptionRequestApprove()
          }}
        />
      )}

      {subscriptionRequestRejectTarget && (
        <RejectSubscriptionRequestDialog
          name={subscriptionRequestRejectTarget.fullName}
          isSubmitting={rejectSubscriptionRequest.isPending}
          onConfirm={handleRejectSubscriptionRequest}
          onOpenChange={(open) => {
            if (!open) setSubscriptionRequestRejectTarget(null)
          }}
        />
      )}

    </div>
  )
}
