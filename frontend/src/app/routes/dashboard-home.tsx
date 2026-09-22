import { CalendarDays, Newspaper } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DashboardEventCard } from '@/features/dashboard/components/dashboard-event-card'
import { DashboardHero } from '@/features/dashboard/components/dashboard-hero'
import { DashboardSection } from '@/features/dashboard/components/dashboard-section'
import { DashboardCardSkeleton } from '@/features/dashboard/components/dashboard-skeletons'
import { DashboardStatCard } from '@/features/dashboard/components/dashboard-stat-card'
import { DashboardStoryCard } from '@/features/dashboard/components/dashboard-story-card'
import type {
  DashboardEventItem,
  DashboardStoryItem,
} from '@/features/dashboard/types'
import { useAuth } from '@/features/auth/auth-provider'
import { formatEventDate } from '@/features/event/lib/format'
import { useEvents } from '@/features/event/hooks/use-events'
import { useStories } from '@/features/story/hooks/use-stories'

const CARD_GRID_CLASS = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
const STATE_MESSAGE_CLASS =
  'rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground'
const MAX_ITEMS = 6

export function DashboardHomePage() {
  const { t } = useTranslation('dashboard')
  const { user } = useAuth()
  const roleName = user?.role?.name ?? ''
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
    page: 1,
    limit: MAX_ITEMS,
    filter: { status: 'PUBLISHED' },
    sortBy: 'publishedAt',
    sortOrder: 'desc',
  })

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
          locationName: event.location?.name ?? null,
          eventTypes: event.eventTypes.map((eventType) => eventType.name),
        },
        time: new Date(upcomingDate.date).getTime(),
      })
    }

    return items
      .sort((a, b) => a.time - b.time)
      .slice(0, MAX_ITEMS)
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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <DashboardHero fullName={user?.fullName ?? ''} roleName={roleName} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>

      <DashboardSection
        title={t('section.upcomingEvents.title')}
        subtitle={t('section.upcomingEvents.subtitle')}
        viewAllLabel={t('section.upcomingEvents.viewAll')}
        viewAllTo="/events"
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
            : events.map((event) => <DashboardEventCard key={event.id} event={event} />)}
        </div>
      </DashboardSection>

      <DashboardSection
        title={t('section.stories.title')}
        subtitle={t('section.stories.subtitle')}
        viewAllLabel={t('section.stories.viewAll')}
        viewAllTo="/stories"
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
      </DashboardSection>
    </div>
  )
}
