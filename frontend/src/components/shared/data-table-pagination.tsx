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
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{t('common:pagination.total', { count: total, entity: entityName, page })}</span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isPending}
          onClick={onPrev}
        >
          {t('common:actions.previous')}
        </Button>
        <Button variant="outline" size="sm" disabled={!hasNextPage || isPending} onClick={onNext}>
          {t('common:actions.next')}
        </Button>
      </div>
    </div>
  )
}
