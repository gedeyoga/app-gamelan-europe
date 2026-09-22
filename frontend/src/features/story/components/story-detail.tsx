import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/datetime'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'

import { STATUS_VARIANT, VISIBILITY_VARIANT } from './status-variant'
import { StoryGallery } from './story-gallery'
import type { Story } from '../types'

export interface StoryDetailProps {
  story: Story
  className?: string
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

// Tipografi konten HTML dari API — mirror utility `RichTextEditor` (tanpa prefix ProseMirror).
const CONTENT_CLASS = cn(
  'text-base leading-7',
  '[&_a]:underline',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold',
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-semibold',
  '[&_img]:max-w-full [&_img]:rounded-lg',
  '[&_ol]:list-decimal [&_ol]:pl-5',
  '[&_p]:my-3',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3',
  '[&_ul]:list-disc [&_ul]:pl-5',
)

export function StoryDetail({ story, className }: StoryDetailProps) {
  const { t } = useTranslation()
  const creatorName = story.creator?.fullName ?? t('story:detail.authorFallback')
  const hasContent = Boolean(story.content && story.content.trim().length > 0)
  const safeContent = useMemo(() => sanitizeHtml(story.content ?? ''), [story.content])

  const meta = (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar size="sm">
        <AvatarFallback>{getInitials(story.creator?.fullName)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{creatorName}</span>
        <span className="text-xs text-muted-foreground">{formatDateTime(story.publishedAt)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
        <Badge variant={STATUS_VARIANT[story.status]}>
          {t(`story:statusOptions.${story.status}`, { defaultValue: story.status })}
        </Badge>
        <Badge variant={VISIBILITY_VARIANT[story.visibility]}>
          {t(`story:visibilityOptions.${story.visibility}`, { defaultValue: story.visibility })}
        </Badge>
      </div>
    </div>
  )

  return (
    <article className={cn('flex flex-col', className)}>
      {story.thumbnail ? (
        <div className="relative w-full">
          <img
            src={story.thumbnail}
            alt={story.name}
            className="aspect-[21/9] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-6">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{story.name}</h1>
              {meta}
            </div>
          </div>
        </div>
      ) : (
        <header className="border-b bg-muted/30">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-20 pb-6">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{story.name}</h1>
            {meta}
          </div>
        </header>
      )}

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
        {hasContent ? (
          // `content` = HTML dari API/editor kaya teks; disanitasi via DOMPurify sebelum render.
          <div className={CONTENT_CLASS} dangerouslySetInnerHTML={{ __html: safeContent }} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('story:detail.noContent')}</p>
        )}

        {(story.gallery ?? []).length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t('story:detail.gallery')}</h2>
            <StoryGallery images={story.gallery ?? []} />
          </section>
        )}

        {(story.flyer ?? []).length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t('story:detail.flyer')}</h2>
            <StoryGallery images={story.flyer ?? []} />
          </section>
        )}
      </div>
    </article>
  )
}
