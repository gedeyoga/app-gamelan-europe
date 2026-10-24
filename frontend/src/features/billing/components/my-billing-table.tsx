import { ExternalLink, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { MobileRecordList } from '@/components/shared/mobile-record-list'
import { MobileSortChips } from '@/components/shared/mobile-sort-chips'
import { SortableHeader, type SortOrder } from '@/components/shared/sortable-header'
import { formatDate, formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { formatMoney } from '../lib/money'
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

function TotalCell({ billing }: { billing: Billing }) {
  const { t } = useTranslation()
  const hasAdjustment = billing.discount != null || billing.tax != null
  return (
    <div className="flex flex-col">
      <span>{formatMoney(billing.total, billing.currency)}</span>
      {hasAdjustment && (
        <span className="text-xs text-muted-foreground">
          {[
            billing.discount != null
              ? `${t('myBilling:table.discount')}: ${formatMoney(billing.discount, '')}`
              : null,
            billing.tax != null
              ? `${t('myBilling:table.tax')}: ${formatMoney(billing.tax, '')}`
              : null,
          ]
            .filter((part): part is string => part !== null)
            .join(' · ')}
        </span>
      )}
    </div>
  )
}

function ProofCell({ billing }: { billing: Billing }) {
  const { t } = useTranslation()
  if (!billing.paymentProofUrl) return <span className="text-muted-foreground">{'—'}</span>
  return (
    <a
      href={billing.paymentProofUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      title={billing.paymentProofName ?? undefined}
    >
      <ExternalLink className="size-3.5" aria-hidden="true" />
      {t('billing:history.viewProof')}
    </a>
  )
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
    <>
      <div className={cn('overflow-hidden rounded-xl border', items.length > 0 && 'max-md:hidden')}>
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
                <SortableHeader label={t('myBilling:table.period')} field="startDate" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label={t('myBilling:table.status')} field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label={t('myBilling:table.total')} field="total" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead>
                <SortableHeader label={t('myBilling:table.paid')} field="paidAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead>{t('myBilling:table.proof')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
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
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {formatDate(billing.startDate)} → {formatDate(billing.expiryDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[billing.status]}>
                      {t(`billing:statusOptions.${billing.status}`, { defaultValue: billing.status })}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <TotalCell billing={billing} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {billing.paidAt ? formatDateTime(billing.paidAt) : '—'}
                  </TableCell>
                  <TableCell>
                    <ProofCell billing={billing} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {items.length > 0 && (
        <MobileSortChips
          options={[
            { field: 'code', label: t('myBilling:table.code') },
            { field: 'subscription.name', label: t('myBilling:table.subscription') },
            { field: 'startDate', label: t('myBilling:table.period') },
            { field: 'status', label: t('myBilling:table.status') },
            { field: 'total', label: t('myBilling:table.total') },
            { field: 'paidAt', label: t('myBilling:table.paid') },
          ]}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      )}

      {items.length > 0 && (
        <MobileRecordList
          items={items.map((billing) => ({
            id: billing.id,
            title: billing.code,
            badge: (
              <Badge variant={STATUS_VARIANT[billing.status]}>
                {t(`billing:statusOptions.${billing.status}`, { defaultValue: billing.status })}
              </Badge>
            ),
            fields: [
              { label: t('myBilling:table.subscription'), value: billing.subscription.name },
              {
                label: t('myBilling:table.period'),
                value: `${formatDate(billing.startDate)} → ${formatDate(billing.expiryDate)}`,
              },
              { label: t('myBilling:table.total'), value: <TotalCell billing={billing} /> },
              {
                label: t('myBilling:table.paid'),
                value: billing.paidAt ? formatDateTime(billing.paidAt) : '—',
              },
              { label: t('myBilling:table.proof'), value: <ProofCell billing={billing} /> },
            ],
          }))}
        />
      )}
    </>
  )
}
