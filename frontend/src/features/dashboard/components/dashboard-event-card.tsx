import { CalendarDays, ImageOff, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { DashboardEventItem } from '../types'

export interface DashboardEventCardProps {
  event: DashboardEventItem
  className?: string
}

export function DashboardEventCard({ event, className }: DashboardEventCardProps) {
  const { t } = useTranslation('dashboard')

  return (
    <Card
      className={cn(
        'relative pt-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      {event.thumbnail ? (
        <img src={event.thumbnail} alt={event.name} className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="size-6" aria-hidden="true" />
          <span className="sr-only">{t('card.noThumbnail')}</span>
        </div>
      )}
      <CardHeader>
        <CardTitle className="line-clamp-2">{event.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {event.eventTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.eventTypes.map((eventType) => (
              <Badge key={eventType} variant="secondary">
                {eventType}
              </Badge>
            ))}
          </div>
        )}
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{event.dateLabel || t('card.noDate')}</span>
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{event.locationName ?? t('card.noLocation')}</span>
        </span>
      </CardContent>
      <Link
        to={`/events/${event.id}`}
        aria-label={t('card.openEvent', { name: event.name })}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
      />
    </Card>
  )
}
