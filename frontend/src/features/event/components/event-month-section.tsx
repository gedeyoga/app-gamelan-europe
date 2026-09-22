import { CalendarDays, ChevronLeft, ChevronRight, ImageOff, MapPin, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/datetime'

import { formatEventDate } from '../lib/format'
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
  onView: (event: Event) => void
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
  onView,
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
            <div key={index} className="flex flex-row gap-0 overflow-hidden rounded-xl border">
              <Skeleton className="w-2/5 shrink-0 rounded-none" />
              <div className="flex w-3/5 min-w-0 flex-col justify-between gap-3 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="mt-auto h-8 w-24" />
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
            <Card key={event.id} className="flex flex-row gap-0 overflow-hidden py-0">
              <div className="w-2/5 shrink-0">
                {event.thumbnail ? (
                  <img
                    src={event.thumbnail}
                    alt={event.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                    <ImageOff className="size-6" aria-hidden="true" />
                    <span className="sr-only">{t('event:card.noThumbnail')}</span>
                  </div>
                )}
              </div>
              <div className="flex w-3/5 min-w-0 flex-col justify-between gap-3 p-4">
                <CardHeader className="px-0">
                  <CardTitle className="line-clamp-2">{event.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-0">
                  {event.eventTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.eventTypes.map((eventType) => (
                        <Badge key={eventType.id} variant="secondary">
                          {eventType.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{event.location?.name ?? '—'}</span>
                  </span>
                  <div className="flex min-w-0 items-start gap-1.5">
                    <CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {event.dates.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex min-w-0 flex-col gap-1">
                        {event.dates.map((d, i) => (
                          <span
                            key={`${d.date}-${i}`}
                            className="truncate text-xs text-muted-foreground"
                          >
                            {formatEventDate(d)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="border-0 bg-transparent p-0">
                  <Button className="w-full" onClick={() => onView(event)}>
                    {t('event:org.viewEvent')}
                  </Button>
                </CardFooter>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
