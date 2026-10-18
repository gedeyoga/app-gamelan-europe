import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import type { NotificationPreference, NotificationType } from '../types'

export interface NotificationPreferencesCardProps {
  items: NotificationPreference[]
  isLoading: boolean
  isError: boolean
  /** Tipe yang PATCH-nya sedang berjalan (selain itu switch aktif). */
  pendingType?: NotificationType | null
  onToggle: (type: NotificationType, emailEnabled: boolean) => void
  onRetry?: () => void
  className?: string
}

/** Preferensi email per tipe notifikasi — presentational, data via props. */
export function NotificationPreferencesCard({
  items,
  isLoading,
  isError,
  pendingType = null,
  onToggle,
  onRetry,
  className,
}: NotificationPreferencesCardProps) {
  const { t } = useTranslation('notification')

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{t('preferences.title')}</CardTitle>
        <CardDescription>{t('preferences.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="flex items-center justify-between gap-3 text-sm text-destructive">
            <span>{t('preferences.loadFailed')}</span>
            {onRetry && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
                <RefreshCw className="size-3.5" data-icon="inline-start" />
                {t('common:actions.retry')}
              </Button>
            )}
          </div>
        ) : (
          items.map((preference) => {
            const id = `notification-preference-${preference.type}`
            return (
              <div key={preference.type} className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <label htmlFor={id} className="text-sm font-medium">
                    {t(`type.${preference.type}`)}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {t('preferences.emailHint')}
                  </span>
                </div>
                <Switch
                  id={id}
                  checked={preference.emailEnabled}
                  disabled={pendingType === preference.type}
                  onCheckedChange={(checked) => onToggle(preference.type, checked)}
                />
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
