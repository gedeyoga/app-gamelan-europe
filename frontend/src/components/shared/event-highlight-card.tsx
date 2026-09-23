import { ImageOff, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { formatDayMonth } from '@/lib/datetime'
import { cn } from '@/lib/utils'

export interface EventHighlightCardProps {
  id: string
  name: string
  thumbnail: string | null
  date: string | null
  locationName: string | null
  eventTypes: string[]
  className?: string
}

/**
 * Kartu event "highlight" bersama (dashboard non-admin + halaman Event non-admin).
 * Presentational murni (flat props, tanpa import lintas domain): cover 16/10 + chip
 * tanggal mengambang + overlay gradien berisi judul/lokasi/tipe.
 * Layout sengaja berbeda dari kartu story/archive (yang teks di bawah gambar).
 */
export function EventHighlightCard({
  id,
  name,
  thumbnail,
  date,
  locationName,
  eventTypes,
  className,
}: EventHighlightCardProps) {
  const { t } = useTranslation('common')
  const { day, month } = formatDayMonth(date)

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm ring-1 ring-foreground/10 transition duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={name}
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
            <ImageOff className="size-6" aria-hidden="true" />
            <span className="sr-only">{t('eventCard.noThumbnail')}</span>
          </div>
        )}

        <div className="absolute top-3 left-3 z-10 flex flex-col items-center rounded-lg border bg-background/90 px-2.5 py-1.5 text-center shadow-sm backdrop-blur">
          <span className="text-xl leading-none font-bold text-foreground">{day}</span>
          <span className="text-[0.625rem] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
            {month}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-foreground/80 via-foreground/30 to-transparent p-4 pt-12">
          <h3 className="line-clamp-2 text-base font-semibold text-background">{name}</h3>
          <span className="flex items-center gap-1.5 text-xs text-background/80">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{locationName ?? t('eventCard.noLocation')}</span>
          </span>
          {eventTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {eventTypes.map((eventType) => (
                <Badge key={eventType} variant="secondary">
                  {eventType}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <Link
        to={`/events/${id}`}
        aria-label={t('eventCard.openEvent', { name })}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
      />
    </div>
  )
}
