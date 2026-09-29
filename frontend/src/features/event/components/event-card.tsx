import {
  Building2,
  CalendarDays,
  ImageOff,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  User,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CARD_GRID_CLASS } from '@/components/shared/card-grid'

import { formatEventDate } from '../lib/format'
import { STATUS_VARIANT } from './status-variant'
import type { Event } from '../types'

export interface EventCardProps {
  items: Event[]
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (event: Event) => void
  onDelete: (event: Event) => void
  /** Dipanggil saat CTA "Tambah" di empty state diklik. */
  onCreate?: () => void
  /** Gate `event:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `event:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
  /** Gate `event:create` — CTA di empty state disembunyikan bila `false`. Default `true`. */
  canCreate?: boolean
}

export function EventCard({
  items,
  searchTerm,
  onResetSearch,
  onEdit,
  onDelete,
  onCreate,
  canUpdate = true,
  canDelete = true,
  canCreate = true,
}: EventCardProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete

  return (
    <div className={CARD_GRID_CLASS}>
      {items.length === 0 ? (
        <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {trimmedSearch.length > 0 ? (
            <>
              {t('event:table.notFound', { term: trimmedSearch })}{' '}
              {onResetSearch && (
                <button
                  className="inline-flex items-center gap-1 underline"
                  onClick={onResetSearch}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  {t('event:table.reset')}
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {t('event:table.empty')}
              {canCreate && onCreate && (
                <Button className="mt-4" onClick={onCreate}>
                  <Plus className="size-4" data-icon="inline-start" />
                  {t('event:add')}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        items.map((event) => (
          <Card key={event.id} className="relative flex h-full flex-col pt-0">
            <div className="relative">
              {event.thumbnail ? (
                <img
                  src={event.thumbnail}
                  alt={event.name}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
                  <ImageOff className="size-6" aria-hidden="true" />
                  <span className="sr-only">{t('event:card.noThumbnail')}</span>
                </div>
              )}
              <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1">
                <Badge className="shadow-sm" variant={STATUS_VARIANT[event.status]}>
                  {t(`event:statusOptions.${event.status}`, { defaultValue: event.status })}
                </Badge>
                {event.visibility === 'PRIVATE' && (
                  <Badge variant="secondary" className="shadow-sm">
                    {t('event:card.memberOnly')}
                  </Badge>
                )}
              </div>
            </div>
            <CardHeader>
              <CardTitle className="line-clamp-2">{event.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2">
              {event.eventTypes.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
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
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {event.creator?.network?.name ?? event.creator?.fullName ?? '—'}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {event.authors.map((author) => author.fullName).join(', ') ||
                    event.creator?.fullName ||
                    '—'}
                </span>
              </span>
              {showActions && (
                <div className="relative z-20 mt-auto grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {canUpdate && (
                    <Button variant="outline" onClick={() => onEdit(event)}>
                      <Pencil className="size-4" data-icon="inline-start" />
                      {t('event:table.edit')}
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="destructive" onClick={() => onDelete(event)}>
                      <Trash2 className="size-4" data-icon="inline-start" />
                      {t('event:table.delete')}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
            {/* Overlay link: menutupi seluruh kartu → buka detail di tab baru.
                Kontrol interaktif dinaikkan `relative z-20` agar klik tidak menavigasi. */}
            <Link
              to={`/events/${event.id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('event:detail.open', { name: event.name })}
              className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
            />
          </Card>
        ))
      )}
    </div>
  )
}
