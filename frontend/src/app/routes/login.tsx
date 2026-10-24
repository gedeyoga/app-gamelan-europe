import { Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { cn } from '@/lib/utils'

function BrandLockup({ label, inverted = false }: { label: string; inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          inverted ? 'bg-background text-foreground' : 'bg-primary text-primary-foreground',
        )}
      >
        <Home className="size-4" />
      </div>
      <span className={cn('text-sm font-semibold', inverted && 'text-background')}>{label}</span>
    </div>
  )
}

export function LoginPage() {
  const { t } = useTranslation('auth')

  return (
    <main className="relative isolate flex min-h-svh w-full items-center justify-center overflow-hidden p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div className="relative size-[min(40rem,120vw)]">
          <div className="absolute inset-0 rounded-full border border-foreground/10" />
          <div className="absolute inset-[14%] rounded-full border border-foreground/10" />
          <div className="absolute inset-[28%] rounded-full border border-foreground/10" />
        </div>
      </div>

      <Card className="grid w-full max-w-4xl gap-0 overflow-hidden p-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 lg:min-h-[34rem] lg:grid-cols-[1.05fr_1fr]">
        <div className="relative hidden min-h-[34rem] overflow-hidden border-r border-border lg:flex">
          <img
            src="/images/login-bali.jpg"
            alt={t('login.imageAlt')}
            loading="eager"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-foreground/75" />

          <div className="relative z-10 flex flex-col justify-between gap-10 p-10">
            <BrandLockup label={t('login.brand')} inverted />

            <div>
              <p className="text-xl font-semibold tracking-tight text-balance text-background">
                {t('login.headline')}
              </p>
              <p className="mt-3 text-sm text-pretty text-background/75">{t('login.subtitle')}</p>
            </div>

            <p className="text-xs text-background/75">{t('login.panelNote')}</p>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="lg:hidden">
            <BrandLockup label={t('login.brand')} />
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl lg:mt-0">
            {t('login.title')}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-pretty lg:hidden">
            {t('login.subtitle')}
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>

          <p className="mt-6 text-xs text-muted-foreground lg:hidden">{t('login.panelNote')}</p>
        </div>
      </Card>
    </main>
  )
}
