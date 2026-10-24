import { MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MobileRecordList } from '@/components/shared/mobile-record-list'
import { MobileSortChips } from '@/components/shared/mobile-sort-chips'
import { SortableHeader, type SortOrder } from '@/components/shared/sortable-header'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
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

interface RowActionsProps {
  role: Role
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
  canUpdate: boolean
  canDelete: boolean
}

function RowActions({ role, onEdit, onDelete, canUpdate, canDelete }: RowActionsProps) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('common:table.actionsFor', { name: role.name })}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canUpdate && (
          <DropdownMenuItem onClick={() => onEdit(role)}>
            <Pencil />
            {t('role:table.edit')}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(role)}>
            <Trash2 />
            {t('role:table.delete')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
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
    <>
      <div className={cn('overflow-hidden rounded-xl border', items.length > 0 && 'max-md:hidden')}>
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
                        <button
                          className="inline-flex items-center gap-1 underline"
                          onClick={onResetSearch}
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
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
                      <RowActions
                        role={role}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {items.length > 0 && (
        <MobileSortChips
          options={[
            { field: 'name', label: t('role:table.name') },
            { field: 'description', label: t('role:table.description') },
            { field: 'createdAt', label: t('role:table.created') },
          ]}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      )}

      {items.length > 0 && (
        <MobileRecordList
          items={items.map((role) => ({
            id: role.id,
            title: role.name,
            fields: [
              {
                label: t('role:table.code'),
                value: <code className="text-xs bg-muted px-1 rounded">{role.code}</code>,
              },
              { label: t('role:table.description'), value: role.description || '—' },
              { label: t('role:table.created'), value: formatDateTime(role.createdAt) },
            ],
            actions: showActions ? (
              <RowActions
                role={role}
                onEdit={onEdit}
                onDelete={onDelete}
                canUpdate={canUpdate}
                canDelete={canDelete}
              />
            ) : undefined,
          }))}
        />
      )}
    </>
  )
}
