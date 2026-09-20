import { ImageOff, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CARD_GRID_CLASS } from '@/components/shared/card-grid'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDateTime } from '@/lib/datetime'

import { STATUS_VARIANT } from './status-variant'
import type { Story } from '../types'

export interface StoryCardProps {
  items: Story[]
  searchTerm?: string
  onResetSearch?: () => void
  onEdit: (story: Story) => void
  onDelete: (story: Story) => void
  /** Gate `story:update` — tombol Edit disembunyikan bila `false`. Default `true`. */
  canUpdate?: boolean
  /** Gate `story:delete` — tombol Hapus disembunyikan bila `false`. Default `true`. */
  canDelete?: boolean
}

export function StoryCard({
  items,
  searchTerm,
  onResetSearch,
  onEdit,
  onDelete,
  canUpdate = true,
  canDelete = true,
}: StoryCardProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete

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
            t('story:table.empty')
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
              <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1">
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
              {showActions && (
                <CardAction>
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
                </CardAction>
              )}
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
                {story.creator?.fullName ?? '—'}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(story.publishedAt)}
              </span>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
