import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface DashboardApprovalColumnProps {
  title: string
  children: ReactNode
  className?: string
}

/** Kolom antrean approval: heading kecil + konten (mis. list pending + pagination). */
export function DashboardApprovalColumn({
  title,
  children,
  className,
}: DashboardApprovalColumnProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}
