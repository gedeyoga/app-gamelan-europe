import type { ContentStatus, Visibility } from '../types'

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

// Map visibilitas → variant Badge (PUBLIC dapat dibagikan, PRIVATE internal).
export const VISIBILITY_VARIANT: Record<Visibility, 'default' | 'secondary'> = {
  PUBLIC: 'default',
  PRIVATE: 'secondary',
}
