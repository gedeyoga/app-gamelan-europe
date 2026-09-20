import * as React from 'react'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DatePicker } from '@/components/shared/date-picker'
import { TimePicker } from '@/components/shared/time-picker'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { EventDateFormValue } from '../lib/schema'

let rowIdSeq = 0
const nextRowId = () => `event-date-${++rowIdSeq}`

export interface EventDatesFieldProps {
  /** Baris tanggal: `date` "YYYY-MM-DD", `startTime`/`endTime` "HH:mm" ('' bila kosong). */
  value: EventDateFormValue[]
  onChange: (next: EventDateFormValue[]) => void
  disabled?: boolean
  className?: string
}

// List tanggal event multi-baris (tanggal + jam mulai + jam selesai); semua input shadcn shared.
export function EventDatesField({
  value,
  onChange,
  disabled = false,
  className,
}: EventDatesFieldProps) {
  const { t } = useTranslation()

  // Id stabil per baris, sejajar dengan `value`; disinkronkan saat add/remove
  // dan bila jumlah baris berubah dari luar (reset form / data awal).
  const [rowIds, setRowIds] = React.useState<string[]>(() =>
    Array.from({ length: value.length }, nextRowId),
  )
  if (rowIds.length !== value.length) {
    setRowIds(value.map((_, index) => rowIds[index] ?? nextRowId()))
  }

  function patchAt(index: number, patch: Partial<EventDateFormValue>) {
    const next = value.slice()
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  function removeAt(index: number) {
    setRowIds((ids) => ids.filter((_, itemIndex) => itemIndex !== index))
    onChange(value.filter((_, itemIndex) => itemIndex !== index))
  }

  function addDate() {
    setRowIds((ids) => [...ids, nextRowId()])
    onChange([...value, { date: '', startTime: '', endTime: '' }])
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {value.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t('event:form.eventDatesEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {value.map((row, index) => (
            <li
              key={rowIds[index] ?? index}
              className={cn('flex flex-col gap-2 rounded-lg border bg-card p-3')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {t('event:form.dayLabel', { number: index + 1 })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={t('event:form.eventDatesRemove')}
                  title={t('event:form.eventDatesRemove')}
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <DatePicker
                value={row.date}
                onChange={(date) => patchAt(index, { date: date ?? '' })}
                placeholder={t('event:form.eventDatesPlaceholder')}
                aria-label={t('event:form.eventDates')}
                disabled={disabled}
                className="min-w-0"
              />

              <div className="grid grid-cols-2 gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <label
                    htmlFor={`${rowIds[index] ?? index}-start`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t('event:form.startTime')}
                  </label>
                  <TimePicker
                    id={`${rowIds[index] ?? index}-start`}
                    value={row.startTime || undefined}
                    onChange={(time) => patchAt(index, { startTime: time ?? '' })}
                    placeholder={t('event:form.timePlaceholder')}
                    aria-label={t('event:form.startTime')}
                    disabled={disabled}
                    className="min-w-0"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label
                    htmlFor={`${rowIds[index] ?? index}-end`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t('event:form.endTime')}
                  </label>
                  <TimePicker
                    id={`${rowIds[index] ?? index}-end`}
                    value={row.endTime || undefined}
                    onChange={(time) => patchAt(index, { endTime: time ?? '' })}
                    placeholder={t('event:form.timePlaceholder')}
                    aria-label={t('event:form.endTime')}
                    disabled={disabled}
                    className="min-w-0"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={disabled}
        onClick={addDate}
      >
        <CalendarPlus className="size-4" data-icon="inline-start" />
        {t('event:form.eventDatesAdd')}
      </Button>
    </div>
  )
}
