import { CalendarDays, User } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/datetime'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'

import { EventInfoCard } from './event-info-card'
import { STATUS_VARIANT, VISIBILITY_VARIANT } from './status-variant'
import type { Event } from '../types'

export interface EventDetailProps {
  event: Event
  className?: string
}

// Tipografi konten HTML dari API — mirror `story-detail.tsx` (tanpa prefix ProseMirror).
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

export function EventDetail({ event, className }: EventDetailProps) {
  const { t } = useTranslation()
  const creatorName = event.creator?.fullName ?? t('event:detail.creatorFallback')
  const hasContent = Boolean(event.content && event.content.trim().length > 0)
  const safeContent = useMemo(() => sanitizeHtml(event.content ?? ''), [event.content])
  const hasThumbnail = Boolean(event.thumbnail)

  return (
    <article className={cn('flex flex-col', className)}>
      <header className="relative isolate w-full overflow-hidden">
        {event.thumbnail ? (
          <img
            src={event.thumbnail}
            alt={event.name}
            className="aspect-[21/9] min-h-64 w-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="aspect-[21/9] min-h-64 w-full bg-gradient-to-br from-primary via-primary/80 to-primary/50"
          />
        )}
        <div
          aria-hidden
          className={cn(
            'absolute inset-0',
            hasThumbnail
              ? 'bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent'
              : 'bg-gradient-to-t from-primary/60 to-transparent',
          )}
        />

        <div className="absolute inset-x-0 bottom-0">
          <div
            className={cn(
              'mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 pb-8',
              hasThumbnail ? 'text-background' : 'text-primary-foreground',
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {event.eventTypes.map((type) => (
                <Badge key={type.id} variant="secondary">
                  {type.name}
                </Badge>
              ))}
              <Badge variant={STATUS_VARIANT[event.status]}>
                {t(`event:statusOptions.${event.status}`, { defaultValue: event.status })}
              </Badge>
              <Badge variant={VISIBILITY_VARIANT[event.visibility]}>
                {t(`event:visibilityOptions.${event.visibility}`, {
                  defaultValue: event.visibility,
                })}
              </Badge>
            </div>

            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{event.name}</h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-80">
              <span className="flex items-center gap-1.5">
                <User className="size-4" />
                {creatorName}
              </span>
              {event.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  <time dateTime={event.publishedAt}>{formatDateTime(event.publishedAt)}</time>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {hasContent ? (
            // `content` = HTML dari API/editor kaya teks; disanitasi via DOMPurify sebelum render.
            <div className={CONTENT_CLASS} dangerouslySetInnerHTML={{ __html: safeContent }} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('event:detail.noContent')}</p>
          )}
        </div>

        <aside className="lg:col-span-1">
          <EventInfoCard
            dates={event.dates}
            location={event.location}
            className="lg:sticky lg:top-8"
          />
        </aside>
      </div>
    </article>
  )
}
