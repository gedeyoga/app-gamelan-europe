import { MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SortableHeader } from '@/components/shared/sortable-header'
import type { SortOrder } from '@/components/shared/sortable-header'
import { formatDateTime } from '@/lib/datetime'

import { formatEventDate } from '../lib/format'
import { STATUS_VARIANT, VISIBILITY_VARIANT } from './status-variant'
import type { Event } from '../types'

export interface EventTableProps {
  items: Event[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (event: Event) => void
  onDelete: (event: Event) => void
  /** Gate `event:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `event:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
}

export function EventTable({
  items,
  sortBy,
  sortOrder,
  onSort,
  searchTerm,
  onResetSearch,
  onEdit,
  onDelete,
  canUpdate = true,
  canDelete = true,
}: EventTableProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete
  const columnCount = showActions ? 9 : 8

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Pengecualian terdokumentasi: `thumbnail`/`eventTypes`/`dates`/`location` tak ada di whitelist sortBy backend. */}
            <TableHead>{t('event:table.thumbnail')}</TableHead>
            <TableHead>
              <SortableHeader
                label={t('event:table.name')}
                field="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>{t('event:table.eventTypes')}</TableHead>
            <TableHead>{t('event:table.dates')}</TableHead>
            <TableHead>{t('event:table.location')}</TableHead>
            <TableHead>
              <SortableHeader
                label={t('event:table.status')}
                field="status"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('event:table.visibility')}
                field="visibility"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('event:table.publishedAt')}
                field="publishedAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            {showActions && (
              <TableHead className="text-right">{t('common:table.actions')}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="h-24 text-center text-sm text-muted-foreground"
              >
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
                  t('event:table.empty')
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  {event.thumbnail ? (
                    <img
                      src={event.thumbnail}
                      alt={event.name}
                      className="size-10 rounded object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {event.dates.length === 0
                    ? '—'
                    : event.dates.map(formatEventDate).join(', ')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {event.location?.name ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[event.status]}>
                    {t(`event:statusOptions.${event.status}`, { defaultValue: event.status })}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={VISIBILITY_VARIANT[event.visibility]}>
                    {t(`event:visibilityOptions.${event.visibility}`, {
                      defaultValue: event.visibility,
                    })}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateTime(event.publishedAt)}</TableCell>
                {showActions && (
                  <TableCell className="text-right">
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
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
