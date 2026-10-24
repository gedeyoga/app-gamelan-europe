import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MobileRecordList } from '@/components/shared/mobile-record-list'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import { formatEventDateLines } from '../lib/format'
import { STATUS_VARIANT } from './status-variant'
import type { Event } from '../types'

export interface MyEventListProps {
  items: Event[]
  isPending: boolean
  /** Pesan error seksi (mis. `event:errors.forbidden`); bila ada tampil menggantikan body. */
  errorMessage?: string
  /** Gate `event:update` — item Edit disembunyikan bila `false`. */
  canUpdate: boolean
  /** Gate `event:delete` — item Delete disembunyikan bila `false`. */
  canDelete: boolean
  /** CTA "Tambah" di empty state; disembunyikan bila tidak diberikan. */
  onCreate?: () => void
  onDetail: (event: Event) => void
  onEdit: (event: Event) => void
  onDelete: (event: Event) => void
  className?: string
}

function EventDates({ event }: { event: Event }) {
  if (event.dates.length === 0) return <>—</>
  return (
    <div className="flex flex-col gap-2">
      {event.dates.map((d, i) => {
        const { date: dateText, time } = formatEventDateLines(d)
        return (
          <span key={`${d.date}-${i}`}>
            {dateText}
            {time && (
              <>
                <br />
                {time}
              </>
            )}
          </span>
        )
      })}
    </div>
  )
}

function EventLocation({ event }: { event: Event }) {
  return (
    <>
      <span className="block">{event.location?.name ?? '—'}</span>
      {event.location?.address && <span className="block text-xs">{event.location.address}</span>}
    </>
  )
}

function EventTypes({ event }: { event: Event }) {
  if (event.eventTypes.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {event.eventTypes.map((eventType) => (
        <Badge key={eventType.id} variant="secondary">
          {eventType.name}
        </Badge>
      ))}
    </div>
  )
}

interface RowActionsProps {
  event: Event
  canUpdate: boolean
  canDelete: boolean
  onDetail: (event: Event) => void
  onEdit: (event: Event) => void
  onDelete: (event: Event) => void
}

function RowActions({ event, canUpdate, canDelete, onDetail, onEdit, onDelete }: RowActionsProps) {
  const { t } = useTranslation()
  const showMenu = canUpdate || canDelete
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button variant="outline" size="sm" onClick={() => onDetail(event)}>
        {t('event:org.detail')}
      </Button>
      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common:table.actionsFor', { name: event.name })}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canUpdate && (
              <DropdownMenuItem onClick={() => onEdit(event)}>
                <Pencil />
                {t('event:table.edit')}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(event)}>
                <Trash2 />
                {t('event:table.delete')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function MyEventList({
  items,
  isPending,
  errorMessage,
  canUpdate,
  canDelete,
  onCreate,
  onDetail,
  onEdit,
  onDelete,
  className,
}: MyEventListProps) {
  const { t } = useTranslation()
  const showList = items.length > 0 && !errorMessage && !isPending

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <h2 className="text-lg font-semibold">{t('event:org.myTitle')}</h2>
      <div className={cn('overflow-hidden rounded-xl border', showList && 'max-md:hidden')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('event:org.columnDate')}</TableHead>
              <TableHead>{t('event:org.columnEventName')}</TableHead>
              <TableHead>{t('event:table.location')}</TableHead>
              <TableHead>{t('event:org.columnCategory')}</TableHead>
              <TableHead>{t('event:table.status')}</TableHead>
              <TableHead className="text-right">{t('common:table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errorMessage ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-sm text-destructive"
                >
                  {errorMessage}
                </TableCell>
              </TableRow>
            ) : isPending ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    {t('event:org.emptyList')}
                    {onCreate && (
                      <Button className="mt-2" onClick={onCreate}>
                        <Plus className="size-4" data-icon="inline-start" />
                        {t('event:add')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-muted-foreground">
                    <EventDates event={event} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {event.thumbnail ? (
                        <img
                          src={event.thumbnail}
                          alt={event.name}
                          className="size-10 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="size-10 shrink-0 rounded bg-muted" />
                      )}
                      <span className="font-medium">{event.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <EventLocation event={event} />
                  </TableCell>
                  <TableCell>
                    <EventTypes event={event} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[event.status]}>
                      {t(`event:statusOptions.${event.status}`, { defaultValue: event.status })}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      event={event}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      onDetail={onDetail}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showList && (
        <MobileRecordList
          items={items.map((event) => ({
            id: event.id,
            title: event.name,
            leading: event.thumbnail ? (
              <img
                src={event.thumbnail}
                alt={event.name}
                className="size-10 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="size-10 shrink-0 rounded bg-muted" />
            ),
            badge: (
              <Badge variant={STATUS_VARIANT[event.status]}>
                {t(`event:statusOptions.${event.status}`, { defaultValue: event.status })}
              </Badge>
            ),
            fields: [
              {
                label: t('event:org.columnDate'),
                value: (
                  <span className="text-muted-foreground">
                    <EventDates event={event} />
                  </span>
                ),
              },
              {
                label: t('event:table.location'),
                value: (
                  <span className="text-muted-foreground">
                    <EventLocation event={event} />
                  </span>
                ),
              },
              { label: t('event:org.columnCategory'), value: <EventTypes event={event} /> },
            ],
            actions: (
              <RowActions
                event={event}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onDetail={onDetail}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ),
          }))}
        />
      )}
    </section>
  )
}
