import { ImageOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Satu baris metadata kartu (ikon + teks); dipasok container, kartu tetap presentational. */
export interface ApprovalMediaCardMeta {
  icon: LucideIcon
  value: string
}

export interface ApprovalMediaCardProps {
  thumbnail: string | null
  title: string
  /** Badge status di samping judul (mis. "Diajukan"). */
  badge: ReactNode
  /** Baris metadata (pengaju/lokasi/tanggal); kosong = blok disembunyikan. */
  metadata: ApprovalMediaCardMeta[]
  /** Tombol aksi footer; disusun container agar gate/handler tetap di sana. */
  actions: ReactNode
  className?: string
}

const CARD_HOVER_CLASS =
  'shadow-sm motion-safe:transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md'

/**
 * Kartu media approval (thumbnail kiri, konten kanan) — visual seragam untuk
 * antrean event member & usulan publik. Murni presentational: tanpa import lintas domain.
 */
export function ApprovalMediaCard({
  thumbnail,
  title,
  badge,
  metadata,
  actions,
  className,
}: ApprovalMediaCardProps) {
  const { t } = useTranslation('common')

  return (
    <Card className={cn('overflow-hidden p-0', CARD_HOVER_CLASS, className)}>
      <div className="flex flex-col sm:flex-row">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted sm:w-48">
          {thumbnail ? (
            <img src={thumbnail} alt={title} loading="lazy" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImageOff className="size-6" aria-hidden="true" />
              <span className="text-xs">{t('eventCard.noThumbnail')}</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading line-clamp-2 font-semibold">{title}</h3>
            {badge}
          </div>

          {metadata.length > 0 && (
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {metadata.map(({ icon: Icon, value }) => (
                <span key={value} className="flex items-center gap-1.5">
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{value}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-3">
            {actions}
          </div>
        </div>
      </div>
    </Card>
  )
}
