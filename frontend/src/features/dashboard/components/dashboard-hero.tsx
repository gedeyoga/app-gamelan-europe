import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface DashboardHeroProps {
  fullName: string
  /** Nama role sesi (mis. `member`/`organization`); kosong → badge disembunyikan. */
  roleName: string
  className?: string
}

export function DashboardHero({ fullName, roleName, className }: DashboardHeroProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section
      className={cn(
        'rounded-2xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8',
        className,
      )}
    >
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        {t('welcome', { name: fullName })}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('subtitle')}</p>
      {roleName && (
        <Badge variant="secondary" className="mt-4">
          {t(`role.${roleName.toLowerCase()}`, { defaultValue: roleName })}
        </Badge>
      )}
    </section>
  )
}
