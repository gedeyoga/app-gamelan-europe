import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface MemberGateProps {
  /** Hasil gate: `true` (member ATAU punya `canViewPrivate`) → render `children`. */
  unlocked: boolean
  /** Dirender hanya bila `unlocked`; opsional (kartu terkunci tidak butuh children). */
  children?: ReactNode
  /** Override judul kartu terkunci (default i18n `common:member.lockedTitle`). */
  title?: string
  /** Override deskripsi kartu terkunci (default i18n `common:member.lockedDescription`). */
  description?: string
  className?: string
}

/**
 * Gate visual untuk konten khusus member. `unlocked` → render `children`;
 * selain itu kartu "khusus member" + CTA ke `/my-billings`.
 */
export function MemberGate({ unlocked, children, title, description, className }: MemberGateProps) {
  const { t } = useTranslation('common')

  if (unlocked) return <>{children}</>

  return (
    <Card className={cn('items-center border-dashed text-center', className)}>
      <CardHeader className="w-full items-center justify-items-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>{title ?? t('member.lockedTitle')}</CardTitle>
        <CardDescription>{description ?? t('member.lockedDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/my-billings">{t('member.becomeMember')}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export interface MemberBadgeProps {
  className?: string
}

/** Badge inline penanda item khusus member. */
export function MemberBadge({ className }: MemberBadgeProps) {
  const { t } = useTranslation('common')

  return (
    <Badge variant="secondary" className={className}>
      {t('member.badge')}
    </Badge>
  )
}

export interface MemberLockBadgeProps {
  className?: string
}

/** Badge inline "terkunci untuk member" (ikon kunci + copy `common:member.lockedTitle`). */
export function MemberLockBadge({ className }: MemberLockBadgeProps) {
  const { t } = useTranslation('common')

  return (
    <Badge variant="secondary" className={cn('gap-1', className)}>
      <Lock className="size-3" aria-hidden="true" />
      {t('member.lockedTitle')}
    </Badge>
  )
}
