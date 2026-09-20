import { ArrowLeft, LogOut, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
 
import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/hooks/useLogout'

/**
 * Halaman 403 — ditampilkan saat user terautentikasi tetapi tak punya
 * permission untuk route tersebut (lihat `RequirePermission`).
 * D render di dalam `DashboardLayout` (punya sidebar + breadcrumb).
 */
export function ForbiddenPage() {
  const { t } = useTranslation()
  const logoutMutation = useLogout()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="size-6 text-destructive" />
      </div>
      <p className="text-sm text-muted-foreground">{t('forbidden.code')}</p>
      <h1 className="text-2xl font-semibold">{t('forbidden.title')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t('forbidden.description')}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/">
            <ArrowLeft data-icon="inline-start" className="size-4" />
            {t('forbidden.backToDashboard')}
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut data-icon="inline-start" className="size-4" />
          {t('forbidden.logout')}
        </Button>
      </div>
    </div>
  )
}
