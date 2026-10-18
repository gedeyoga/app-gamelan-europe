import { useEffect, useState } from 'react'
import { Bell, CheckCheck, RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { DataTablePagination } from '@/components/shared/data-table-pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isForbiddenError } from '@/features/auth/lib/permissions'
import { useMarkAllNotificationsRead } from '@/features/notification/hooks/use-mark-all-notifications-read'
import { useMarkNotificationRead } from '@/features/notification/hooks/use-mark-notification-read'
import { useNotifications } from '@/features/notification/hooks/use-notifications'
import type { NotificationItem } from '@/features/notification/types'
import { formatDateTime } from '@/lib/datetime'
import { getApiErrorMessage, isValidationError, toastError, toastSuccess } from '@/lib/toast'
import { cn } from '@/lib/utils'

const PAGE_LIMIT = 20

function isExternalPath(path: string): boolean {
  return /^(https?:)?\/\//i.test(path)
}

export function NotificationsPage() {
  const { t } = useTranslation('notification')
  const [page, setPage] = useState(1)
  const notificationsQuery = useNotifications({ page, limit: PAGE_LIMIT })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const items = notificationsQuery.data?.items ?? []
  const total = notificationsQuery.data?.total ?? 0
  const hasUnread = items.some((item) => !item.readAt)

  // Clamp boundary saat daftar menyusut (mis. setelah "tandai semua").
  useEffect(() => {
    if (total > 0 && page > 1 && (page - 1) * PAGE_LIMIT >= total) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(Math.max(1, Math.ceil(total / PAGE_LIMIT)))
    }
  }, [total, page])

  function handleMarkRead(id: string) {
    markRead.mutate(id, {
      onSuccess: () => toastSuccess(t('toast.read')),
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('toast.readFailed')))
      },
    })
  }

  function handleMarkAllRead() {
    markAllRead.mutate(undefined, {
      onSuccess: () => toastSuccess(t('toast.allRead')),
      onError: (err: unknown) => {
        if (isValidationError(err)) return
        toastError(getApiErrorMessage(err, t('toast.allReadFailed')))
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasUnread || markAllRead.isPending}
          onClick={handleMarkAllRead}
        >
          <CheckCheck className="size-4" data-icon="inline-start" />
          {t('markAllRead')}
        </Button>
      </header>

      {notificationsQuery.isError ? (
        isForbiddenError(notificationsQuery.error) ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <ShieldAlert className="size-6 text-destructive" />
            <p className="text-sm font-medium">{t('errors.forbidden')}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {t('errors.loadData')}
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={() => void notificationsQuery.refetch()}
            >
              <RefreshCw className="size-3.5" data-icon="inline-start" />
              {t('common:actions.retry')}
            </Button>
          </div>
        )
      ) : notificationsQuery.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <Bell className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{t('empty')}</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                isPending={markRead.isPending && markRead.variables === item.id}
                onMarkRead={handleMarkRead}
                markReadLabel={t('markRead')}
                openLabel={t('open')}
                unreadLabel={t('unread')}
                readLabel={t('read')}
              />
            ))}
          </ul>

          <DataTablePagination
            page={page}
            limit={PAGE_LIMIT}
            total={total}
            entityName={t('title')}
            isPending={notificationsQuery.isFetching}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => prev + 1)}
          />
        </>
      )}
    </div>
  )
}

interface NotificationRowProps {
  item: NotificationItem
  isPending: boolean
  onMarkRead: (id: string) => void
  markReadLabel: string
  openLabel: string
  unreadLabel: string
  readLabel: string
}

function NotificationRow({
  item,
  isPending,
  onMarkRead,
  markReadLabel,
  openLabel,
  unreadLabel,
  readLabel,
}: NotificationRowProps) {
  const isUnread = !item.readAt

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-4',
        isUnread && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn('text-sm', isUnread && 'font-semibold')}>{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(item.createdAt)}
          </p>
        </div>
        <Badge variant={isUnread ? 'default' : 'secondary'}>
          {isUnread ? unreadLabel : readLabel}
        </Badge>
      </div>

      <p className="whitespace-pre-line text-sm text-muted-foreground">{item.body}</p>

      <div className="flex flex-wrap items-center gap-2">
        {item.linkPath &&
          (isExternalPath(item.linkPath) ? (
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <a href={item.linkPath} target="_blank" rel="noopener noreferrer">
                {openLabel}
              </a>
            </Button>
          ) : (
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link to={item.linkPath}>{openLabel}</Link>
            </Button>
          ))}
        {isUnread && (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onMarkRead(item.id)}
          >
            <CheckCheck className="size-4" data-icon="inline-start" />
            {markReadLabel}
          </Button>
        )}
      </div>
    </li>
  )
}
