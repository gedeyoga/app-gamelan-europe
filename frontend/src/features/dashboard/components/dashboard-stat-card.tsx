import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface DashboardStatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  hint?: string
  className?: string
}

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: DashboardStatCardProps) {
  return (
    <Card className={cn('gap-0', className)}>
      <CardContent className="flex items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
