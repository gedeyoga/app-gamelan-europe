import { Check, Eye, RotateCcw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SortableHeader, type SortOrder } from '@/components/shared/sortable-header'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

import { SubscriptionRequestStatusBadge } from './subscription-request-status-badge'
import type { SubscriptionRequest } from '../types'

export interface SubscriptionRequestTableProps {
  items: SubscriptionRequest[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onView: (request: SubscriptionRequest) => void
  onApprove: (request: SubscriptionRequest) => void
  onReject: (request: SubscriptionRequest) => void
  /** Gate `subscription-request:approve`. */
  canApprove?: boolean
  /** Gate `subscription-request:reject`. */
  canReject?: boolean
  /** Id request yang sedang diproses; aksi baris tsb dinonaktifkan. */
  busyId?: string
  className?: string
}

// Tabel antrean request langganan (admin) — presentational, state di container.
export function SubscriptionRequestTable({
  items,
  sortBy,
  sortOrder,
  onSort,
  searchTerm,
  onResetSearch,
  onView,
  onApprove,
  onReject,
  canApprove = true,
  canReject = true,
  busyId,
  className,
}: SubscriptionRequestTableProps) {
  const { t } = useTranslation('subscriptionRequest')
  const trimmedSearch = searchTerm?.trim() ?? ''

  return (
    <div className={cn('overflow-x-auto rounded-xl border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader
                label={t('table.requester')}
                field="fullName"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('table.email')}
                field="email"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('table.plan')}
                field="subscription.name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('table.type')}
                field="requestType"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('table.status')}
                field="status"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('table.created')}
                field="createdAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead className="text-right">{t('common:table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                {trimmedSearch.length > 0 ? (
                  <>
                    {t('table.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 underline"
                        onClick={onResetSearch}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        {t('table.reset')}
                      </button>
                    )}
                  </>
                ) : (
                  t('table.empty')
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((request) => {
              const busy = busyId === request.id
              const pending = request.status === 'PENDING'
              return (
                <TableRow key={request.id} aria-busy={busy}>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{request.fullName}</span>
                      {request.organisation && (
                        <span className="truncate text-xs text-muted-foreground">
                          {request.organisation}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="truncate text-muted-foreground">
                    {request.email}
                  </TableCell>
                  <TableCell>{request.subscription.name}</TableCell>
                  <TableCell>
                    {t(`requestTypeOptions.${request.requestType}`, {
                      defaultValue: request.requestType,
                    })}
                  </TableCell>
                  <TableCell>
                    <SubscriptionRequestStatusBadge status={request.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {formatDateTime(request.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => onView(request)}>
                        <Eye className="size-4" data-icon="inline-start" />
                        {t('actions.view')}
                      </Button>
                      {canApprove && (
                        <Button
                          size="sm"
                          disabled={!pending || busy}
                          onClick={() => onApprove(request)}
                        >
                          <Check className="size-4" data-icon="inline-start" />
                          {t('actions.approve')}
                        </Button>
                      )}
                      {canReject && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!pending || busy}
                          onClick={() => onReject(request)}
                        >
                          <X className="size-4" data-icon="inline-start" />
                          {t('actions.reject')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
