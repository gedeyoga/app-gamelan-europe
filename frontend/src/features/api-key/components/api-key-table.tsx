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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/datetime'

import type { ApiKey } from '../types'

export const API_KEY_MASK = '••••••••'

export interface ApiKeyTableProps {
  items: ApiKey[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (apiKey: ApiKey) => void
  onDelete: (apiKey: ApiKey) => void
  /** Gate `apikey:update`. Default `true`. */
  canUpdate?: boolean
  /** Gate `apikey:delete`. Default `true`. */
  canDelete?: boolean
}

export function ApiKeyTable({
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
}: ApiKeyTableProps) {
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
              <SortableHeader
                label={t('api-key:table.name')}
                field="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('api-key:table.key')}
                field="prefix"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>{t('api-key:table.permissions')}</TableHead>
            <TableHead>
              <SortableHeader
                label={t('api-key:table.lastUsed')}
                field="lastUsedAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('api-key:table.created')}
                field="createdAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            {showActions && <TableHead className="text-right">{t('common:table.actions')}</TableHead>}
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
                    {t('api-key:table.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button
                        className="inline-flex items-center gap-1 underline"
                        onClick={onResetSearch}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        {t('api-key:table.reset')}
                      </button>
                    )}
                  </>
                ) : (
                  t('api-key:table.empty')
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((apiKey) => (
              <TableRow key={apiKey.id}>
                <TableCell className="font-medium">{apiKey.name}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1 text-xs">
                    {apiKey.prefix}
                    {API_KEY_MASK}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {apiKey.permissions.length === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      apiKey.permissions.map((code) => (
                        <Badge key={code} variant="secondary" className="font-mono">
                          {code}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {apiKey.lastUsedAt ? formatDateTime(apiKey.lastUsedAt) : t('api-key:table.never')}
                </TableCell>
                <TableCell>{formatDateTime(apiKey.createdAt)}</TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('common:table.actionsFor', { name: apiKey.name })}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => onEdit(apiKey)}>
                            <Pencil />
                            {t('api-key:table.edit')}
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(apiKey)}
                          >
                            <Trash2 />
                            {t('api-key:table.delete')}
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
