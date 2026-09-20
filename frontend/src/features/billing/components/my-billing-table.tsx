import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
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

export interface MyBillingTableProps {
  items: Billing[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
}

// Tabel billing milik user sendiri: tanpa kolom user & tanpa aksi admin.
export function MyBillingTable({
  items,
  sortBy,
  sortOrder,
  onSort,
  searchTerm,
  onResetSearch,
}: MyBillingTableProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader label={t('myBilling:table.code')} field="code" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('myBilling:table.subscription')} field="subscription.name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('myBilling:table.status')} field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('myBilling:table.total')} field="total" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('myBilling:table.created')} field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                {trimmedSearch.length > 0 ? (
                  <>
                    {t('myBilling:billings.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button
                        className="inline-flex items-center gap-1 underline"
                        onClick={onResetSearch}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        {t('myBilling:billings.reset')}
                      </button>
                    )}
                  </>
                ) : (
                  t('myBilling:billings.empty')
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((billing) => (
              <TableRow key={billing.id}>
                <TableCell className="font-medium">{billing.code}</TableCell>
                <TableCell>{billing.subscription.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[billing.status]}>
                    {t(`billing:statusOptions.${billing.status}`, { defaultValue: billing.status })}
                  </Badge>
                </TableCell>
                <TableCell>{`${billing.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${billing.currency}`}</TableCell>
                <TableCell>{formatDateTime(billing.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
