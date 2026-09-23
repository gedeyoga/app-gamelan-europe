import { ImageOff, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CARD_GRID_CLASS } from '@/components/shared/card-grid'
import { formatDateTime } from '@/lib/datetime'

import { STATUS_VARIANT, TYPE_VARIANT } from './status-variant'
import type { Archive } from '../types'

export interface ArchiveCardProps {
  items: Archive[]
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

export function ArchiveCard({
  items,
  searchTerm,
  onResetSearch,
  onEdit,
  onDelete,
  onCreate,
  canUpdate = true,
  canDelete = true,
  canCreate = true,
}: ArchiveCardProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''
  const showActions = canUpdate || canDelete

  return (
    <div className={CARD_GRID_CLASS}>
      {items.length === 0 ? (
        <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
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
        </div>
      ) : (
        items.map((archive) => (
          <Card key={archive.id} className="pt-0">
            <div className="relative">
              <Link
                to={`/archives/${archive.id}`}
                aria-label={t('archive:detail.open', { name: archive.name })}
              >
                {archive.thumbnail ? (
                  <img
                    src={archive.thumbnail}
                    alt={archive.name}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
                    <ImageOff className="size-6" aria-hidden="true" />
                    <span className="sr-only">{t('archive:card.noThumbnail')}</span>
                  </div>
                )}
              </Link>
              <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1">
                <Badge className="shadow-sm" variant={TYPE_VARIANT[archive.type]}>
                  {t(`archive:typeOptions.${archive.type}`, { defaultValue: archive.type })}
                </Badge>
                <Badge className="shadow-sm" variant={STATUS_VARIANT[archive.status]}>
                  {t(`archive:statusOptions.${archive.status}`, { defaultValue: archive.status })}
                </Badge>
              </div>
            </div>
            <CardHeader>
              <CardTitle className="line-clamp-2">
                <Link to={`/archives/${archive.id}`} className="hover:underline">
                  {archive.name}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
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
              <span className="text-xs text-muted-foreground">
                {formatDateTime(archive.publishedAt)}
              </span>
              {showActions && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {canUpdate && (
                    <Button variant="outline" onClick={() => onEdit(archive)}>
                      <Pencil className="size-4" data-icon="inline-start" />
                      {t('archive:table.edit')}
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="destructive" onClick={() => onDelete(archive)}>
                      <Trash2 className="size-4" data-icon="inline-start" />
                      {t('archive:table.delete')}
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
