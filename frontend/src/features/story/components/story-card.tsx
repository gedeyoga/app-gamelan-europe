import { ImageOff, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { CARD_GRID_CLASS } from '@/components/shared/card-grid'
import { formatDateTime } from '@/lib/datetime'

import { STATUS_VARIANT } from './status-variant'
import type { Story } from '../types'

export interface StoryCardProps {
  items: Story[]
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (story: Story) => void
  onDelete: (story: Story) => void
  /** Dipanggil saat CTA "Tambah" di empty state diklik. */
  onCreate?: () => void
  /** Gate `story:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `story:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
  /** Gate `story:create` — CTA di empty state disembunyikan bila `false`. Default `true`. */
  canCreate?: boolean
  /** ID story terpilih (bulk action). */
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  /** Sedang mengambil semua ID (select-all). */
  isSelectingAll?: boolean
  /** Mutasi bulk sedang berjalan — checkbox di-disable. */
  isBulkPending?: boolean
  /** Tampilkan checkbox. Default `true`. */
  canBulkUpdate?: boolean
}

export function StoryCard({
  items,
  searchTerm,
  onResetSearch,
  onEdit,
  onDelete,
  onCreate,
  canUpdate = true,
  canDelete = true,
  canCreate = true,
  selectedIds,
  onSelectionChange,
  isSelectingAll = false,
  isBulkPending = false,
  canBulkUpdate = true,
}: StoryCardProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete
  const bulkDisabled = isSelectingAll || isBulkPending

  function toggleRow(id: string, checked: boolean) {
    onSelectionChange(checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id))
  }

  return (
    <div className={CARD_GRID_CLASS}>
      {items.length === 0 ? (
        <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
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
            <div className="flex flex-col items-center gap-2">
              {t('story:table.empty')}
              {canCreate && onCreate && (
                <Button className="mt-4" onClick={onCreate}>
                  <Plus className="size-4" data-icon="inline-start" />
                  {t('story:add')}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        items.map((story) => (
          <Card key={story.id} className="pt-0">
            <div className="relative">
              <Link
                to={`/stories/${story.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('story:detail.open', { name: story.name })}
              >
                {story.thumbnail ? (
                  <img
                    src={story.thumbnail}
                    alt={story.name}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
                    <ImageOff className="size-6" aria-hidden="true" />
                    <span className="sr-only">{t('story:card.noThumbnail')}</span>
                  </div>
                )}
              </Link>
              <div className="absolute left-2 top-2 z-20 flex flex-wrap items-center gap-1">
                {canBulkUpdate && (
                  <span className="rounded bg-background/90 p-1 shadow-sm">
                    <Checkbox
                      checked={selectedIds.includes(story.id)}
                      onCheckedChange={(checked) => toggleRow(story.id, checked === true)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={bulkDisabled}
                      aria-label={t('story:bulk.selectRow', { name: story.name })}
                    />
                  </span>
                )}
                <Badge className="shadow-sm" variant={STATUS_VARIANT[story.status]}>
                  {t(`story:statusOptions.${story.status}`, { defaultValue: story.status })}
                </Badge>
                {story.visibility === 'PRIVATE' && (
                  <Badge variant="secondary" className="shadow-sm">
                    {t('story:card.memberOnly')}
                  </Badge>
                )}
              </div>
            </div>
            <CardHeader>
              <CardTitle className="line-clamp-2">
                <Link
                  to={`/stories/${story.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {story.name}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
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
              <span className="truncate text-muted-foreground">
                {story.authors.map((author) => author.fullName).join(', ') ||
                  story.creator?.fullName ||
                  '—'}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(story.publishedAt)}
              </span>
              {showActions && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {canUpdate && (
                    <Button variant="outline" onClick={() => onEdit(story)}>
                      <Pencil className="size-4" data-icon="inline-start" />
                      {t('story:table.edit')}
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="destructive" onClick={() => onDelete(story)}>
                      <Trash2 className="size-4" data-icon="inline-start" />
                      {t('story:table.delete')}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
