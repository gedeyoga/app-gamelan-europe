import { ExternalLink, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { formatDateTime } from '@/lib/datetime'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { Billing, BillingStatus, MemberSubscription } from '../types'

const STATUS_VARIANT: Record<BillingStatus, 'default' | 'secondary' | 'destructive'> = {
  PENDING: 'secondary',
  PAID: 'default',
  CANCELED: 'destructive',
}

export interface BillingHistoryDialogProps {
  member: MemberSubscription
  items: Billing[]
  page: number
  limit: number
  total: number
  isPending: boolean
  isError: boolean
  isForbidden: boolean
  onPrev: () => void
  onNext: () => void
  onOpenChange: (open: boolean) => void
}

// Dialog riwayat billing milik satu member. Data + pagination dari container (route).
export function BillingHistoryDialog({
  member,
  items,
  page,
  limit,
  total,
  isPending,
  isError,
  isForbidden,
  onPrev,
  onNext,
  onOpenChange,
}: BillingHistoryDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('billing:history.title')}</DialogTitle>
          <DialogDescription>
            {t('billing:history.description', { name: member.user.fullName })}
          </DialogDescription>
        </DialogHeader>

        {isError ? (
          isForbidden ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
              <ShieldAlert className="size-6 text-destructive" />
              <p className="text-sm font-medium">{t('billing:errors.forbidden')}</p>
            </div>
          ) : (
            <p className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
              {t('billing:errors.loadData')}
            </p>
          )
        ) : isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('billing:history.table.code')}</TableHead>
                    <TableHead>{t('billing:history.table.plan')}</TableHead>
                    <TableHead>{t('billing:history.table.status')}</TableHead>
                    <TableHead>{t('billing:history.table.proof')}</TableHead>
                    <TableHead>{t('billing:history.table.total')}</TableHead>
                    <TableHead>{t('billing:history.table.paidAt')}</TableHead>
                    <TableHead>{t('billing:history.table.canceledAt')}</TableHead>
                    <TableHead>{t('billing:history.table.expiryDate')}</TableHead>
                    <TableHead>{t('billing:history.table.created')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        {t('billing:history.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((billing) => (
                      <TableRow key={billing.id}>
                        <TableCell className="font-medium">{billing.code}</TableCell>
                        <TableCell>{billing.subscription.name}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[billing.status]}>
                            {t(`billing:statusOptions.${billing.status}`, {
                              defaultValue: billing.status,
                            })}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {billing.paymentProofUrl ? (
                            <a
                              href={billing.paymentProofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex max-w-40 flex-col text-primary hover:underline"
                            >
                              <span className="inline-flex items-center gap-1 text-sm font-medium">
                                <ExternalLink className="size-3.5" aria-hidden="true" />
                                {t('billing:history.viewProof')}
                              </span>
                              {billing.paymentProofName && (
                                <span
                                  className="truncate text-xs text-muted-foreground"
                                  title={billing.paymentProofName}
                                >
                                  {billing.paymentProofName}
                                </span>
                              )}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{'—'}</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {`${billing.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${billing.currency}`}
                        </TableCell>
                        <TableCell>{formatDateTime(billing.paidAt)}</TableCell>
                        <TableCell>{formatDateTime(billing.canceledAt)}</TableCell>
                        <TableCell>{formatDateTime(billing.expiryDate)}</TableCell>
                        <TableCell>{formatDateTime(billing.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination
              page={page}
              limit={limit}
              total={total}
              entityName={t('billing:history.title')}
              isPending={isPending}
              onPrev={onPrev}
              onNext={onNext}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
