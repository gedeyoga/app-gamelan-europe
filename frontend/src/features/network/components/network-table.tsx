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

import type { Network, NetworkStatus } from '../types'

const STATUS_VARIANT: Record<NetworkStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'secondary',
  REQUEST: 'outline',
  APPROVED: 'default',
  PUBLISHED: 'default',
}

export interface NetworkTableProps {
  items: Network[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (network: Network) => void
  onDelete: (network: Network) => void
  /** Gate `network:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `network:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
}

export function NetworkTable({
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
}: NetworkTableProps) {
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
              <SortableHeader label={t('network:table.name')} field="name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('network:table.ledBy')} field="ledBy" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('network:table.city')} field="city" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('network:table.country')} field="country" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('network:table.status')} field="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
            </TableHead>
            <TableHead>
              <SortableHeader label={t('network:table.created')} field="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
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
                    {t('network:table.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button
                        className="inline-flex items-center gap-1 underline"
                        onClick={onResetSearch}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        {t('network:table.reset')}
                      </button>
                    )}
                  </>
                ) : (
                  t('network:table.empty')
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((network) => (
              <TableRow key={network.id}>
                <TableCell className="font-medium">{network.name}</TableCell>
                <TableCell>{network.ledBy ?? '—'}</TableCell>
                <TableCell>{network.city?.name ?? '—'}</TableCell>
                <TableCell>{network.country ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[network.status]}>
                    {t(`network:statusOptions.${network.status}`, { defaultValue: network.status })}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateTime(network.createdAt)}</TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t('common:table.actionsFor', { name: network.name })}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => onEdit(network)}>
                            <Pencil />
                            {t('network:table.edit')}
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(network)}>
                            <Trash2 />
                            {t('network:table.delete')}
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
