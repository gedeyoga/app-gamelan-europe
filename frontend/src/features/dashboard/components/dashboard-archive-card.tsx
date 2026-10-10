import { ArrowRight, CalendarDays, ImageOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { MemberBadge, MemberLockBadge } from '@/components/shared/member-gate'
import { Badge } from '@/components/ui/badge'
import { useMembership } from '@/features/auth/hooks/use-membership'
import { useAuthPermissions } from '@/features/auth/hooks/use-permissions'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

import type { DashboardArchiveType, DashboardArchiveItem } from '../types'

const TYPE_VARIANT: Record<DashboardArchiveType, 'default' | 'secondary'> = {
  PUBLIC: 'default',
  MEMBER: 'secondary',
}

/** Jumlah badge kategori yang tampil sebelum sisanya diringkas jadi "+N". */
const MAX_VISIBLE_CATEGORIES = 3

export interface DashboardArchiveCardProps {
  archive: DashboardArchiveItem
  className?: string
}

/**
 * Kartu arsip bermotif **folder/dossier**: tab lengkung di tepi atas + cover 16/9
 * dengan ribbon tipe (kiri-atas). Sengaja berbeda dari kartu
 * story (teks bawah gambar, tanpa tab) dan kartu event highlight (overlay media penuh).
 */
export function DashboardArchiveCard({ archive, className }: DashboardArchiveCardProps) {
  const { t } = useTranslation('dashboard')
  const isMember = useMembership()
  const { canViewPrivate } = useAuthPermissions()
  const unlocked = isMember || canViewPrivate
  const categoryOverflow = archive.categories.length - MAX_VISIBLE_CATEGORIES

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg',
        className,
      )}
    >
      <span
        className="absolute top-0 left-4 z-20 h-1.5 w-16 rounded-b-full bg-primary"
        aria-hidden="true"
      />

      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {archive.thumbnail ? (
          <img
            src={archive.thumbnail}
            alt={archive.name}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
            <ImageOff className="size-6" aria-hidden="true" />
            <span className="sr-only">{t('card.noThumbnail')}</span>
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/40 to-transparent"
          aria-hidden="true"
        />

        {archive.type === 'MEMBER' ? (
          unlocked ? (
            <MemberBadge className="absolute top-3 left-3 z-10 shadow-sm" />
          ) : (
            <MemberLockBadge className="absolute top-3 left-3 z-10 shadow-sm" />
          )
        ) : (
          <Badge
            variant={TYPE_VARIANT[archive.type]}
            className="absolute top-3 left-3 z-10 shadow-sm"
          >
            {t(`archive:typeOptions.${archive.type}`)}
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {archive.categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {archive.categories.slice(0, MAX_VISIBLE_CATEGORIES).map((category) => (
              <Badge key={category} variant="ghost" className="bg-primary/10 text-primary">
                {category}
              </Badge>
            ))}
            {categoryOverflow > 0 && (
              <Badge variant="outline" className="text-muted-foreground">
                {`+${categoryOverflow}`}
              </Badge>
            )}
          </div>
        )}

        <h3 className="font-heading line-clamp-2 text-lg font-semibold">{archive.name}</h3>

        {archive.description ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">{archive.description}</p>
        ) : (
          <p className="line-clamp-3 text-sm text-muted-foreground/70 italic">
            {t('card.noDescription')}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{formatDateTime(archive.publishedAt)}</span>
          </span>
          <span
            className="flex items-center text-primary transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          >
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>

      <Link
        to={`/archives/${archive.id}`}
        aria-label={t('card.openArchive', { name: archive.name })}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
      />
    </article>
  )
}
