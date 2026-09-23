import type { ArchiveStatus, ArchiveType } from '../types'

// Map status → variant Badge, dipakai bersama `archive-table.tsx` & `archive-card.tsx`.
export const STATUS_VARIANT: Record<
  ArchiveStatus,
  'default' | 'secondary' | 'outline'
> = {
  DRAFT: 'secondary',
  REQUEST: 'outline',
  APPROVED: 'default',
  PUBLISHED: 'default',
}

// Map tipe → variant Badge (PUBLIC = default, MEMBER = secondary).
export const TYPE_VARIANT: Record<ArchiveType, 'default' | 'secondary'> = {
  PUBLIC: 'default',
  MEMBER: 'secondary',
}
