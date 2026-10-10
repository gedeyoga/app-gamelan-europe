import { ArrowUpCircle, Ban, History, Plus, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SortableHeader, type SortOrder } from '@/components/shared/sortable-header'
import { formatDate } from '@/lib/datetime'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { MemberSubscription, MemberSubscriptionStatus } from '../types'

const STATUS_VARIANT: Record<MemberSubscriptionStatus, 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  NONE: 'outline',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

export interface BillingMemberTableProps {
  items: MemberSubscription[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onUpgrade: (member: MemberSubscription) => void
  onNew: (member: MemberSubscription) => void
  onCancel: (member: MemberSubscription) => void
  onHistory: (member: MemberSubscription) => void
  /** Gate `billing:create` — tombol Upgrade/New subscription disembunyikan bila `false`. */
  canCreate?: boolean
  /** Gate `billing:update` — tombol Cancel disembunyikan bila `false`. */
  canUpdate?: boolean
  /** Gate `billing:read` — tombol History disembunyikan bila `false`. */
  canRead?: boolean
}

// Tabel manajemen langganan member: avatar, user, paket, expiry, status, aksi kondisional.
export function BillingMemberTable({
  items,
  sortBy,
  sortOrder,
  onSort,
  searchTerm,
  onResetSearch,
  onUpgrade,
  onNew,
  onCancel,
  onHistory,
  canCreate = true,
  canUpdate = true,
  canRead = true,
}: BillingMemberTableProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canCreate || canUpdate || canRead
  const columnCount = showActions ? 6 : 5

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <span className="sr-only">{t('billing:table.photo')}</span>
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('billing:table.user')}
                field="user.fullName"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('billing:table.plan')}
                field="subscription.name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('billing:table.expiry')}
                field="expiryDate"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('billing:table.status')}
                field="status"
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
                    {t('billing:table.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button
                        type="button"
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
            items.map((member) => {
              const isActive = member.status === 'ACTIVE'
              return (
                <TableRow key={member.userId}>
                  <TableCell>
                    <Avatar>
                      {member.user.avatar && (
                        <AvatarImage src={member.user.avatar} alt={member.user.fullName} />
                      )}
                      <AvatarFallback>{initials(member.user.fullName)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{member.user.fullName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{member.subscription?.name ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(member.expiryDate)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[member.status]}>
                      {t(`billing:memberStatusOptions.${member.status}`, {
                        defaultValue: member.status,
                      })}
                    </Badge>
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isActive ? (
                          <>
                            {canCreate && (
                              <Button size="sm" variant="outline" onClick={() => onUpgrade(member)}>
                                <ArrowUpCircle className="size-4" data-icon="inline-start" />
                                {t('billing:actions.upgrade')}
                              </Button>
                            )}
                            {canUpdate && (
                              <Button size="sm" variant="destructive" onClick={() => onCancel(member)}>
                                <Ban className="size-4" data-icon="inline-start" />
                                {t('billing:actions.cancel')}
                              </Button>
                            )}
                          </>
                        ) : (
                          canCreate && (
                            <Button size="sm" onClick={() => onNew(member)}>
                              <Plus className="size-4" data-icon="inline-start" />
                              {t('billing:actions.new')}
                            </Button>
                          )
                        )}
                        {canRead && (
                          <Button size="sm" variant="ghost" onClick={() => onHistory(member)}>
                            <History className="size-4" data-icon="inline-start" />
                            {t('billing:actions.history')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
