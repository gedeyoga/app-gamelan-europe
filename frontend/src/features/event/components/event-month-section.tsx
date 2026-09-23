import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EventHighlightCard } from '@/components/shared/event-highlight-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'

import type { Event } from '../types'

export interface EventMonthSectionProps {
  /** Bulan terpilih (tanggal 1, waktu lokal). */
  month: Date
  items: Event[]
  isPending: boolean
  /** Pesan error seksi (mis. `event:errors.forbidden`); bila ada tampil menggantikan konten. */
  errorMessage?: string
  onPrevMonth: () => void
  onNextMonth: () => void
  /** CTA "Tambah" di empty state; disembunyikan bila tidak diberikan. */
  onCreate?: () => void
  className?: string
}

export function EventMonthSection({
  month,
  items,
  isPending,
  errorMessage,
  onPrevMonth,
  onNextMonth,
  onCreate,
  className,
}: EventMonthSectionProps) {
  const { t } = useTranslation()
  // Label bulan locale browser — satu-satunya formatter lewat `@/lib/datetime`.
  const monthLabel = formatDate(month, undefined, {
    dateStyle: undefined,
    month: 'long',
    year: 'numeric',
  })

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('event:org.monthTitle')}</h2>
        <div className="inline-flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevMonth}
            aria-label={t('event:org.prevMonth')}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextMonth}
            aria-label={t('event:org.nextMonth')}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            {t('event:org.emptyMonth')}
            {onCreate && (
              <Button className="mt-2" onClick={onCreate}>
                <Plus className="size-4" data-icon="inline-start" />
                {t('event:add')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((event) => (
            <EventHighlightCard
              key={event.id}
              id={event.id}
              name={event.name}
              thumbnail={event.thumbnail}
              date={event.dates[0]?.date ?? null}
              locationName={event.location?.name ?? null}
              eventTypes={event.eventTypes.map((eventType) => eventType.name)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
