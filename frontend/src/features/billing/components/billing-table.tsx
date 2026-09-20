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
import { SortableHeader, type SortOrder } from '@/components/shared/sortable-header'
import { formatDateTime } from '@/lib/datetime'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { Billing, BillingStatus } from '../types'

const STATUS_VARIANT: Record<BillingStatus, 'default' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  PAID: 'default',
  CANCELED: 'destructive',
}

export interface BillingTableProps {
  items: Billing[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (billing: Billing) => void
  onDelete: (billing: Billing) => void
  /** Gate `billing:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `billing:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
}

export function BillingTable({
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
}: BillingTableProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete
  const columnCount = showActions ? 7 : 6
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader label={t('billing:table.code')} field="code" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('billing:table.user')} field="user.fullName" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('billing:table.subscription')} field="subscription.name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('billing:table.status')} field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('billing:table.total')} field="total" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('billing:table.created')} field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            {showActions && <TableHead className="text-right">{t('common:table.actions')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-24 text-center text-sm text-muted-foreground">
                {trimmedSearch.length > 0 ? (
                  <>
                    {t('billing:table.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button
                        className="inline-flex items-center gap-1 underline"
                        onClick={onResetSearch}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        {t('billing:table.reset')}
                      </button>
                    )}
                  </>
                ) : (
                  t('billing:table.empty')
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((billing) => (
              <TableRow key={billing.id}>
                <TableCell className="font-medium">{billing.code}</TableCell>
                <TableCell>{billing.user.fullName}</TableCell>
                <TableCell>{billing.subscription.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[billing.status]}>
                    {t(`billing:statusOptions.${billing.status}`, { defaultValue: billing.status })}
                  </Badge>
                </TableCell>
                <TableCell>{`${billing.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${billing.currency}`}</TableCell>
                <TableCell>{formatDateTime(billing.createdAt)}</TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t('common:table.actionsFor', { name: billing.code })}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => onEdit(billing)}>
                            <Pencil />
                            {t('billing:table.edit')}
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(billing)}>
                            <Trash2 />
                            {t('billing:table.delete')}
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
