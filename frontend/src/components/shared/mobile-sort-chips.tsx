import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { SortOrder } from './sortable-header'

export interface MobileSortOption {
  field: string
  label: string
}

export interface MobileSortChipsProps {
  options: MobileSortOption[]
  sortBy: string | null
  sortOrder: SortOrder | null
  onSort: (field: string) => void
}

// Order-by versi mobile: tabel + SortableHeader-nya disembunyikan di < md,
// chip ini memakai `onSort` yang sama (cycle asc → desc → null).
export function MobileSortChips({ options, sortBy, sortOrder, onSort }: MobileSortChipsProps) {
  const { t } = useTranslation()
  if (options.length === 0) return null
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:hidden">
      {options.map((option) => {
        const active = sortBy === option.field && sortOrder !== null
        const Icon = !active ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown
        return (
          <Button
            key={option.field}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSort(option.field)}
            aria-label={t('common:sort.by', { column: option.label })}
            aria-pressed={active}
            className={cn('shrink-0 gap-1', active && 'text-foreground')}
          >
            {option.label}
            <Icon
              className={cn('size-3.5', !active && 'text-muted-foreground')}
              aria-hidden="true"
              data-icon="inline-end"
            />
          </Button>
        )
      })}
    </div>
  )
}
