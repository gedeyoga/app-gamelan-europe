import { MoreHorizontal } from 'lucide-react'
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

import type { User, UserStatus } from '../types'

const STATUS_VARIANT: Record<UserStatus, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  BLOCKED: 'destructive',
}

export interface UserTableProps {
  items: User[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (user: User) => void
  onDelete: (user: User) => void
  /** Gate `user:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `user:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
}

export function UserTable({
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
}: UserTableProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete
  const columnCount = showActions ? 6 : 5
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader label={t('user:table.name')} field="fullName" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('user:table.email')} field="email" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('user:table.status')} field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('user:table.role')} field="roleName" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('user:table.created')} field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
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
                    {t('user:table.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button className="underline" onClick={onResetSearch}>
                        {t('user:table.reset')}
                      </button>
                    )}
                  </>
                ) : (
                  t('user:table.empty')
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.fullName}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[user.status]}>
                    {t(`user:statusOptions.${user.status}`, { defaultValue: user.status })}
                  </Badge>
                </TableCell>
                <TableCell>{user.role?.name ?? '—'}</TableCell>
                <TableCell>{formatDateTime(user.createdAt)}</TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t('common:table.actionsFor', { name: user.fullName })}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => onEdit(user)}>{t('user:table.edit')}</DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(user)}>
                            {t('user:table.delete')}
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
