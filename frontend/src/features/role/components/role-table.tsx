import { MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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

import type { Role } from '../types'

export interface RoleTableProps {
  items: Role[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
  /** Gate `role:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `role:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
}

export function RoleTable({
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
}: RoleTableProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete
  const columnCount = showActions ? 5 : 4
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader label={t('role:table.name')} field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>{t('role:table.code')}</TableHead>
            <TableHead>
              <SortableHeader label={t('role:table.description')} field="description" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('role:table.created')} field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
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
                    {t('role:table.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button className="underline" onClick={onResetSearch}>
                        {t('role:table.reset')}
                      </button>
                    )}
                  </>
                ) : (
                  t('role:table.empty')
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-1 rounded">{role.code}</code>
                </TableCell>
                <TableCell>{role.description || '—'}</TableCell>
                <TableCell>{formatDateTime(role.createdAt)}</TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t('common:table.actionsFor', { name: role.name })}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => onEdit(role)}>{t('role:table.edit')}</DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(role)}>
                            {t('role:table.delete')}
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
