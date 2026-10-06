import { Copy, ExternalLink, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DATETIME_FALLBACK } from '@/lib/datetime'
import { toastError, toastSuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'

import { EventLocationMap } from './event-location-map'
import { formatEventDateLong } from '../lib/format'
import type { EventDate, EventEntry, EventLocation, EventType } from '../types'

export interface EventInfoCardProps {
  dates: EventDate[]
  location: EventLocation | null
  eventTypes: EventType[]
  entry: EventEntry
  className?: string
}

interface Coordinates {
  lat: number
  lng: number
}

interface DetailRow {
  label: string
  value: string
}

/** Koordinat valid → `{lat,lng}`; selain itu `null`. */
function toCoordinates(location: EventLocation | null): Coordinates | null {
  if (!location || location.lat === null || location.lng === null) return null
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null
  return { lat: location.lat, lng: location.lng }
}

/** `"HH:mm–HH:mm"`; salah satu sisi saja bila pasangannya kosong; `''` bila dua-duanya kosong. */
function formatTimeRange({ startTime, endTime }: EventDate): string {
  return startTime && endTime ? `${startTime}–${endTime}` : startTime || endTime || ''
}

/**
 * Kartu "Event Details": baris LABEL — value (DATE/TIME per `EventDate`, LOCATION,
 * VENUE, TYPE, ENTRY), plus alamat + aksi maps/copy + peta read-only.
 */
export function EventInfoCard({ dates, location, eventTypes, entry, className }: EventInfoCardProps) {
  const { t } = useTranslation()
  const coords = toCoordinates(location)
  const hasLocation = Boolean(location && (location.name || location.address || coords))

  // LOCATION = City, Country saja (state tidak ditampilkan); kosong dibuang.
  const locationName = [location?.city?.name, location?.country?.name]
    .filter((name): name is string => Boolean(name))
    .join(', ')
  const venue = location?.name ?? ''
  const typeNames = eventTypes.map((type) => type.name).join(', ')

  const rows: DetailRow[] = [
    ...dates.flatMap<DetailRow>((date) => [
      {
        label: t('event:detail.date'),
        // `formatEventDateLong` proyeksikan noon lokal — hari tak bergeser di offset negatif.
        value: formatEventDateLong(date),
      },
      {
        label: t('event:detail.time'),
        value: formatTimeRange(date) || DATETIME_FALLBACK,
      },
    ]),
    ...(locationName ? [{ label: t('event:detail.location'), value: locationName }] : []),
    ...(venue ? [{ label: t('event:detail.venue'), value: venue }] : []),
    ...(typeNames ? [{ label: t('event:detail.type'), value: typeNames }] : []),
    { label: t('event:detail.entry'), value: t(`event:entryOptions.${entry}`) },
  ]

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
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Info className="size-4 text-muted-foreground" data-icon="inline-start" />
            {t('event:detail.detailsTitle')}
          </h2>
          <dl className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <div key={`${row.label}-${index}`} className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-sm font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {hasLocation && location && (
          <section className="flex flex-col gap-3">
            {location.address && (
              <p className="text-sm text-muted-foreground">{location.address}</p>
            )}
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
