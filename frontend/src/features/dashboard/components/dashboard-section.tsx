import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export interface DashboardSectionProps {
  title: string
  subtitle?: string
  /** Label link "Lihat semua"; hanya dirender bila `viewAllTo` juga diisi. */
  viewAllLabel?: string
  viewAllTo?: string
  /** Node empty state; bila diisi menggantikan `children`. */
  empty?: ReactNode
  children?: ReactNode
  className?: string
}

export function DashboardSection({
  title,
  subtitle,
  viewAllLabel,
  viewAllTo,
  empty,
  children,
  className,
}: DashboardSectionProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {viewAllTo && viewAllLabel && (
          <Link
            to={viewAllTo}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {viewAllLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      {empty ?? children}
    </section>
  )
}
