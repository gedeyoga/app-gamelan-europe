import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  className?: string
}

// Kartu statistik reusable: ikon + label + nilai (tabular-nums) + hint opsional.
// ponytail: bentuk sama dengan features/dashboard/components/dashboard-stat-card.tsx
// (dibiarkan utuh); arahkan dashboard ke sini saat file itu disentuh berikutnya.
export function StatCard({ icon: Icon, label, value, hint, className }: StatCardProps) {
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
