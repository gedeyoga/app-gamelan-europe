import * as React from 'react'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export interface DatePickerProps
  extends Omit<React.ComponentProps<'button'>, 'onChange' | 'value' | 'id'> {
  /** Tanggal saja `"YYYY-MM-DD"`. */
  value?: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  id?: string
}

// `"YYYY-MM-DD"` → Date lokal tengah hari (hindari geser hari oleh timezone).
function parse(value?: string): Date | null {
  const match = value ? DATE_ONLY_PATTERN.exec(value) : null
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
}

// Date lokal → `"YYYY-MM-DD"` (pakai komponen lokal, bukan `toISOString`).
function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// Komponen presentational: pemilihan tanggal (tanpa jam) via shadcn Popover + Calendar single.
// Kompatibel `<FormControl>`/`<FormItem>` (meneruskan `id`, `aria-*`, `disabled`, `ref` ke trigger Button).
export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  function DatePicker(
    { value, onChange, placeholder, id, disabled, className, ...props },
    ref,
  ) {
    const [open, setOpen] = React.useState(false)
    const selected = parse(value)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={selected === null}
            className={cn(
              'w-full justify-start gap-2 font-normal data-[empty=true]:text-muted-foreground',
              className,
            )}
            {...props}
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            {selected ? formatDate(selected) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected ?? undefined}
            onSelect={(date) => onChange(date ? toDateOnly(date) : undefined)}
            disabled={disabled}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    )
  },
)
