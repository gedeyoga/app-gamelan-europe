import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export interface DataTablePaginationProps {
  page: number
  limit: number
  total: number
  entityName: string
  isPending?: boolean
  onPrev: () => void
  onNext: () => void
}

// Pagination standar semua tabel CRUD (dipakai bersama SearchBar + SortableHeader).
export function DataTablePagination({
  page,
  limit,
  total,
  entityName,
  isPending = false,
  onPrev,
  onNext,
}: DataTablePaginationProps) {
  const { t } = useTranslation()
  const hasNextPage = total > page * limit

  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <span>{t('common:pagination.total', { count: total, entity: entityName, page })}</span>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isPending}
          onClick={onPrev}
        >
          <ChevronLeft className="size-4" data-icon="inline-start" />
          {t('common:actions.previous')}
        </Button>
        <Button variant="outline" size="sm" disabled={!hasNextPage || isPending} onClick={onNext}>
          {t('common:actions.next')}
          <ChevronRight className="size-4" data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}
