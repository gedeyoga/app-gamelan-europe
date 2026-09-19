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

import { STATUS_VARIANT } from './status-variant'
import type { Story } from '../types'

export interface StoryTableProps {
  items: Story[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (story: Story) => void
  onDelete: (story: Story) => void
  /** Gate `story:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `story:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
}

export function StoryTable({
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
}: StoryTableProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete
  const columnCount = showActions ? 7 : 6

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Pengecualian terdokumentasi: `thumbnail`/`categories`/author tak ada di whitelist sortBy backend. */}
            <TableHead>{t('story:table.thumbnail')}</TableHead>
            <TableHead>
              <SortableHeader
                label={t('story:table.name')}
                field="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>{t('story:table.categories')}</TableHead>
            <TableHead>{t('story:table.author')}</TableHead>
            <TableHead>
              <SortableHeader
                label={t('story:table.status')}
                field="status"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label={t('story:table.publishedAt')}
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
                    {t('story:table.notFound', { term: trimmedSearch })}{' '}
                    {onResetSearch && (
                      <button
                        className="inline-flex items-center gap-1 underline"
                        onClick={onResetSearch}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        {t('story:table.reset')}
                      </button>
                    )}
                  </>
                ) : (
                  t('story:table.empty')
                )}
              </TableCell>
            </TableRow>
          ) : (
            items.map((story) => (
              <TableRow key={story.id}>
                <TableCell>
                  {story.thumbnail ? (
                    <img
                      src={story.thumbnail}
                      alt={story.name}
                      className="size-10 rounded object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{story.name}</TableCell>
                <TableCell>
                  {story.categories.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {story.categories.map((category) => (
                        <Badge key={category.id} variant="secondary">
                          {category.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {story.creator?.fullName ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[story.status]}>
                    {t(`story:statusOptions.${story.status}`, { defaultValue: story.status })}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateTime(story.publishedAt)}</TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('common:table.actionsFor', { name: story.name })}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => onEdit(story)}>
                            <Pencil />
                            {t('story:table.edit')}
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(story)}>
                            <Trash2 />
                            {t('story:table.delete')}
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
