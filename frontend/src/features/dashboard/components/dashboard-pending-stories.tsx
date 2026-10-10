import { Check, Pencil, Tag, User, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { ApprovalMediaCard } from './approval-media-card'
import type { ApprovalMediaCardMeta } from './approval-media-card'
import type { DashboardPendingStoryItem } from '../types'

export interface DashboardPendingStoriesProps {
  items: DashboardPendingStoryItem[]
  isPending: boolean
  isError: boolean
  canApprove: boolean
  canReject: boolean
  canUpdate: boolean
  /** Query list sedang refetch (mis. setelah mutation); tombol aksi ditahan. */
  isRefreshing?: boolean
  onEdit: (id: string) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  /** Id story yang sedang diproses; tombol aksi baris tsb dinonaktifkan. */
  busyId?: string
  className?: string
}

export function DashboardPendingStories({
  items,
  isPending,
  isError,
  canApprove,
  canReject,
  canUpdate,
  isRefreshing = false,
  onEdit,
  onApprove,
  onReject,
  busyId,
  className,
}: DashboardPendingStoriesProps) {
  const { t } = useTranslation('dashboard')

  if (isPending) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="@container overflow-hidden p-0">
            <div className="flex flex-col @md:flex-row">
              <Skeleton className="aspect-video w-full rounded-none @md:w-48" />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="mt-auto flex justify-end gap-2 pt-3">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (isError || items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {isError ? t('section.pendingStories.error') : t('section.pendingStories.empty')}
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {items.map((item) => {
        const busy = busyId === item.id
        const actionsDisabled = busy || isRefreshing
        const categories = item.categories.join(' · ')
        const metadata: ApprovalMediaCardMeta[] = [
          { icon: User, value: item.creatorName ?? t('pending.unknown') },
          ...(categories ? [{ icon: Tag, value: categories }] : []),
        ]
        return (
          <ApprovalMediaCard
            key={item.id}
            thumbnail={item.thumbnail}
            title={item.name}
            badge={
              <>
                <Badge variant="secondary" className="shrink-0">
                  {t('story:statusOptions.REQUEST')}
                </Badge>
                <Badge variant="outline" className="shrink-0">
                  {t(`source.${item.source}`)}
                </Badge>
              </>
            }
            metadata={metadata}
            actions={
              <>
                {canUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionsDisabled}
                    aria-busy={busy}
                    onClick={() => onEdit(item.id)}
                  >
                    <Pencil className="size-4" data-icon="inline-start" />
                    {t('common:actions.edit')}
                  </Button>
                )}
                {canApprove && (
                  <Button
                    size="sm"
                    disabled={actionsDisabled}
                    aria-busy={busy}
                    onClick={() => onApprove(item.id)}
                  >
                    <Check className="size-4" data-icon="inline-start" />
                    {t('pending.approve')}
                  </Button>
                )}
                {canReject && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionsDisabled}
                    aria-busy={busy}
                    onClick={() => onReject(item.id)}
                  >
                    <X className="size-4" data-icon="inline-start" />
                    {t('pending.reject')}
                  </Button>
                )}
              </>
            }
          />
        )
      })}
    </div>
  )
}
