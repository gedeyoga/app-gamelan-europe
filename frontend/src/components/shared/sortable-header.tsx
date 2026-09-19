import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type SortOrder = 'asc' | 'desc'

export interface SortableHeaderProps {
  label: string
  field: string
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
  className?: string
  align?: 'left' | 'right'
}

// Header kolom sortable untuk semua tabel CRUD.
// Klik → cycle asc → desc → null (kembali ke default backend createdAt desc).
export function SortableHeader({
  label,
  field,
  sortBy,
  sortOrder,
  onSort,
  className,
  align = 'left',
}: SortableHeaderProps) {
  const { t } = useTranslation()
  const active = sortBy === field && sortOrder !== null
  const Icon = !active ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onSort(field)}
      aria-label={t('common:sort.by', { column: label })}
      aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        '-ml-2 h-8 gap-1 px-2 font-medium',
        align === 'right' && 'ml-auto',
        active && 'text-foreground',
        className,
      )}
    >
      {label}
      <Icon
        className={cn('size-3.5', !active && 'text-muted-foreground')}
        aria-hidden="true"
        data-icon="inline-end"
      />
    </Button>
  )
}
