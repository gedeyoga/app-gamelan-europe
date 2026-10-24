import { Fragment, type ReactNode } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export interface MobileRecordField {
  label: ReactNode
  value: ReactNode
}

export interface MobileRecordItem {
  id: string
  title: ReactNode
  /** Mis. checkbox bulk / thumbnail. */
  leading?: ReactNode
  /** Mis. badge status. */
  badge?: ReactNode
  fields: MobileRecordField[]
  /** Mis. trigger dropdown aksi baris. */
  actions?: ReactNode
}

export interface MobileRecordListProps {
  items: MobileRecordItem[]
  className?: string
}

// Card list pengganti tabel pada layar < md. Presentational: semua teks via props.
export function MobileRecordList({ items, className }: MobileRecordListProps) {
  const isMobile = useIsMobile()
  if (!isMobile) return null
  return (
    <ul className={cn('flex flex-col gap-3 md:hidden', className)}>
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border p-3">
          <div className="flex items-start gap-2">
            {item.leading && <div className="shrink-0 pt-0.5">{item.leading}</div>}
            <div className="min-w-0 flex-1 break-words font-medium">{item.title}</div>
          </div>
          {item.badge && <div className="mt-2 flex flex-wrap gap-1">{item.badge}</div>}
          {item.fields.length > 0 && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {item.fields.map((field, index) => (
                <Fragment key={index}>
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="min-w-0 break-words">{field.value}</dd>
                </Fragment>
              ))}
            </dl>
          )}
          {item.actions && (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">{item.actions}</div>
          )}
        </li>
      ))}
    </ul>
  )
}
