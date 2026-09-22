import { ImageOff, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'

import type { DashboardStoryItem } from '../types'

export interface DashboardStoryCardProps {
  story: DashboardStoryItem
  className?: string
}

export function DashboardStoryCard({ story, className }: DashboardStoryCardProps) {
  const { t } = useTranslation('dashboard')

  return (
    <Card
      className={cn(
        'relative pt-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      {story.thumbnail ? (
        <img src={story.thumbnail} alt={story.name} className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
          <ImageOff className="size-6" aria-hidden="true" />
          <span className="sr-only">{t('card.noThumbnail')}</span>
        </div>
      )}
      <CardHeader>
        <CardTitle className="line-clamp-2">{story.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {story.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {story.categories.map((category) => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))}
          </div>
        )}
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{story.authorName ?? '—'}</span>
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(story.publishedAt)}</span>
      </CardContent>
      <Link
        to={`/stories/${story.id}`}
        aria-label={t('card.openStory', { name: story.name })}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
      />
    </Card>
  )
}
