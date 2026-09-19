import type { ContentStatus } from '../types'

// Map status → variant Badge, dipakai bersama `story-table.tsx` & `story-card.tsx`.
export const STATUS_VARIANT: Record<
  ContentStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'secondary',
  REQUEST: 'outline',
  APPROVED: 'default',
  PUBLISHED: 'default',
}
