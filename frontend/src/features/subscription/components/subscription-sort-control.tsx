import { ArrowUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ListSortOrder } from '@/lib/list-params'

import { SUBSCRIPTION_SORTABLE_FIELDS } from '../types'

/** Nilai sentinel "tanpa sort" → default backend `createdAt desc`. Bukan string kosong (dilarang Radix Select). */
export const SUBSCRIPTION_SORT_DEFAULT = 'default'

const SORT_ORDERS: readonly ListSortOrder[] = ['asc', 'desc']

export interface SubscriptionSortControlProps {
  sortBy: string | null
  sortOrder: ListSortOrder | null
  /** Terima nilai kombinasi `"<field>:<order>"` atau {@link SUBSCRIPTION_SORT_DEFAULT}. */
  onSort: (value: string) => void
}

// Pengganti SortableHeader untuk tampilan kartu (tak ada header kolom):
// satu Select berisi semua field sortable backend × arah.
export function SubscriptionSortControl({
  sortBy,
  sortOrder,
  onSort,
}: SubscriptionSortControlProps) {
  const { t } = useTranslation()
  const value = sortBy && sortOrder ? `${sortBy}:${sortOrder}` : SUBSCRIPTION_SORT_DEFAULT

  return (
    <Select value={value} onValueChange={onSort}>
      <SelectTrigger aria-label={t('subscription:sort.ariaLabel')}>
        <ArrowUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={SUBSCRIPTION_SORT_DEFAULT}>{t('common:sort.default')}</SelectItem>
        {SUBSCRIPTION_SORTABLE_FIELDS.flatMap((field) =>
          SORT_ORDERS.map((order) => (
            <SelectItem key={`${field}:${order}`} value={`${field}:${order}`}>
              {t(`subscription:fields.${field}`)} · {t(`common:sort.${order}`)}
            </SelectItem>
          )),
        )}
      </SelectContent>
    </Select>
  )
}
