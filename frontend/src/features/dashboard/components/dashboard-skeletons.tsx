import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface DashboardCardSkeletonProps {
  className?: string
}

/** Kerangka kartu event/story (thumbnail + judul + 2 baris meta). */
export function DashboardCardSkeleton({ className }: DashboardCardSkeletonProps) {
  return (
    <Card className={cn('pt-0', className)}>
      <Skeleton className="aspect-video w-full rounded-none" />
      <CardHeader>
        <Skeleton className="h-5 w-3/4" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-5 w-24 rounded-4xl" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  )
}
