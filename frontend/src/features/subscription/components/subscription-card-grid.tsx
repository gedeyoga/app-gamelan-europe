import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { CARD_GRID_CLASS } from '@/components/shared/card-grid'

import { SubscriptionCard } from './subscription-card'
import type { Subscription } from '../types'

export interface SubscriptionCardGridProps {
  items: Subscription[]
  onEdit: (subscription: Subscription) => void
  onDelete: (subscription: Subscription) => void
  /** Gate `subscription:update` — diteruskan ke kartu. Default `true`. */
  canUpdate?: boolean
  /** Gate `subscription:delete` — diteruskan ke kartu. Default `true`. */
  canDelete?: boolean
  searchTerm?: string
  onResetSearch?: () => void
}

// Tampilan list subscription sebagai grid kartu (pengganti tabel).
// Kartu presentational di `subscription-card.tsx`; grid ini hanya layout + empty state.
export function SubscriptionCardGrid({
  items,
  onEdit,
  onDelete,
  canUpdate = true,
  canDelete = true,
  searchTerm,
  onResetSearch,
}: SubscriptionCardGridProps) {
  const { t } = useTranslation()
  const trimmedSearch = searchTerm?.trim() ?? ''

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {trimmedSearch.length > 0 ? (
          <>
            {t('subscription:card.notFound', { term: trimmedSearch })}{' '}
            {onResetSearch && (
              <Button
                variant="link"
                size="sm"
                className="h-auto gap-1 p-0 font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={onResetSearch}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {t('subscription:card.reset')}
              </Button>
            )}
          </>
        ) : (
          t('subscription:card.empty')
        )}
      </div>
    )
  }

  return (
    <div className={CARD_GRID_CLASS}>
      {items.map((subscription) => (
        <SubscriptionCard
          key={subscription.id}
          subscription={subscription}
          onEdit={onEdit}
          onDelete={onDelete}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      ))}
    </div>
  )
}
