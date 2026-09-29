import { MoreHorizontal, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SortableHeader } from '@/components/shared/sortable-header'
import type { SortOrder } from '@/components/shared/sortable-header'
import { formatDateTime } from '@/lib/datetime'

import { STATUS_VARIANT, TYPE_VARIANT } from './status-variant'
import type { Archive } from '../types'

export interface ArchiveTableProps {
  items: Archive[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (archive: Archive) => void
  onDelete: (archive: Archive) => void
  /** Dipanggil saat CTA "Tambah" di empty state diklik. */
  onCreate?: () => void
  /** Gate `archive:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `archive:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
  /** Gate `archive:create` — CTA di empty state disembunyikan bila `false`. Default `true`. */
  canCreate?: boolean
}

export function ArchiveTable({
  items,
  sortBy,
  sortOrder,
  onSort,
  searchTerm,
  onResetSearch,
  onEdit,
  onDelete,
  onCreate,
  canUpdate = true,
  canDelete = true,
  canCreate = true,
}: ArchiveTableProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete
  const columnCount = showActions ? 8 : 7

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Pengecualian terdokumentasi: `thumbnail`/`categories` tak ada di whitelist sortBy backend. */}
            <TableHead>{t('archive:table.thumbnail')}</TableHead>
            <TableHead>
              <SortableHeader
                label={t('archive:table.title')}
                field="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>{t('archive:table.categories')}</TableHead>
            <TableHead>{t('archive:table.author')}</TableHead>
            <TableHead>
              <SortableHeader
                label={t('archive:table.type')}
                field="type"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('archive:table.status')}
                field="status"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('archive:table.publishedAt')}
                field="publishedAt"
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
                    {t('archive:table.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button
                        className="inline-flex items-center gap-1 underline"
                        onClick={onResetSearch}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        {t('archive:table.reset')}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    {t('archive:table.empty')}
                    {canCreate && onCreate && (
                      <Button className="mt-4" onClick={onCreate}>
                        <Plus className="size-4" data-icon="inline-start" />
                        {t('archive:add')}
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((archive) => (
              <TableRow key={archive.id}>
                <TableCell>
                  {archive.thumbnail ? (
                    <img
                      src={archive.thumbnail}
                      alt={archive.name}
                      className="size-10 rounded object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    to={`/archives/${archive.id}`}
                    className="hover:underline"
                    aria-label={t('archive:detail.open', { name: archive.name })}
                  >
                    {archive.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {archive.categories.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {archive.categories.map((category) => (
                        <Badge key={category.id} variant="secondary">
                          {category.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {archive.authors.map((author) => author.fullName).join(', ') || '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[archive.type]}>
                    {t(`archive:typeOptions.${archive.type}`, { defaultValue: archive.type })}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[archive.status]}>
                    {t(`archive:statusOptions.${archive.status}`, { defaultValue: archive.status })}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateTime(archive.publishedAt)}</TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('common:table.actionsFor', { name: archive.name })}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => onEdit(archive)}>
                            <Pencil />
                            {t('archive:table.edit')}
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(archive)}>
                            <Trash2 />
                            {t('archive:table.delete')}
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
