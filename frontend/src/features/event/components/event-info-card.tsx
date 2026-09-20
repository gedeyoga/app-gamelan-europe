import { CalendarDays, Clock, Copy, ExternalLink, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toastError, toastSuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'

import { getEventDateParts } from '../lib/format'
import { EventLocationMap } from './event-location-map'
import type { EventDate, EventLocation } from '../types'

export interface EventInfoCardProps {
  dates: EventDate[]
  location: EventLocation | null
  className?: string
}

interface Coordinates {
  lat: number
  lng: number
}

/** Koordinat valid → `{lat,lng}`; selain itu `null`. */
function toCoordinates(location: EventLocation | null): Coordinates | null {
  if (!location || location.lat === null || location.lng === null) return null
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null
  return { lat: location.lat, lng: location.lng }
}

/** Kartu info event: blok tanggal (per `EventDate`) + lokasi, peta read-only, aksi maps/copy. */
export function EventInfoCard({ dates, location, className }: EventInfoCardProps) {
  const { t } = useTranslation()
  const coords = toCoordinates(location)
  const hasDates = dates.length > 0
  const hasLocation = Boolean(location && (location.name || location.address || coords))

  if (!hasDates && !hasLocation) return null

  async function handleCopy(address: string) {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(address)
      toastSuccess(t('event:detail.addressCopied'))
    } catch {
      toastError(t('event:detail.addressCopyFailed'))
    }
  }

  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-col gap-6">
        {hasDates && (
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-muted-foreground" data-icon="inline-start" />
              {t('event:detail.dates')}
            </h2>
            <ul className="flex flex-col gap-3">
              {dates.map((date, index) => {
                const parts = getEventDateParts(date)
                return (
                  <li key={`${parts.iso}-${index}`} className="flex items-center gap-3">
                    <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <span className="text-lg font-bold leading-none">{parts.day}</span>
                      <span className="text-xs font-medium uppercase leading-none tracking-wide">
                        {parts.monthYear}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {parts.iso ? (
                        <time dateTime={parts.iso} className="text-sm font-medium">
                          {parts.weekday}
                        </time>
                      ) : (
                        <span className="text-sm font-medium">{parts.weekday}</span>
                      )}
                      {parts.timeRange && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {parts.timeRange}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {hasLocation && location && (
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 text-muted-foreground" data-icon="inline-start" />
              {t('event:detail.location')}
            </h2>
            <div className="flex flex-col gap-0.5">
              {location.name && <p className="text-sm font-medium">{location.name}</p>}
              {location.address && (
                <p className="text-sm text-muted-foreground">{location.address}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {coords && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-3.5" data-icon="inline-start" />
                    {t('event:detail.openInMaps')}
                  </a>
                </Button>
              )}
              {location.address && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleCopy(location.address as string)}
                >
                  <Copy className="size-3.5" data-icon="inline-start" />
                  {t('event:detail.copyAddress')}
                </Button>
              )}
            </div>
            {coords && (
              <EventLocationMap
                lat={coords.lat}
                lng={coords.lng}
                label={t('event:detail.mapAlt')}
              />
            )}
          </section>
        )}
      </CardContent>
    </Card>
  )
}
