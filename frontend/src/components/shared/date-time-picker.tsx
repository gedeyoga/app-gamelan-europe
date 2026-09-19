import * as React from 'react'
import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))

export interface DateTimePickerProps
  extends Omit<React.ComponentProps<'button'>, 'onChange' | 'value' | 'id'> {
  /** ISO 8601 (UTC) */
  value?: string
  onChange: (iso: string | undefined) => void
  placeholder?: string
  id?: string
}

// Kontrak: `value` = ISO UTC; tampil memakai zona client (parse `new Date`, bukan manual-offset).
function parse(value?: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// Tanggal lokal + jam/menit lokal → ISO UTC.
function combine(date: Date, hour: number, minute: number): string {
  const next = new Date(date)
  next.setHours(hour, minute, 0, 0)
  return next.toISOString()
}

// Komponen presentational: semua pemilihan tanggal/waktu lewat shadcn (Popover + Calendar, jam/menit via Select).
// Kompatibel `<FormControl>`/`<FormItem>` (meneruskan `id`, `aria-*`, `disabled`, `ref` ke trigger Button).
export const DateTimePicker = React.forwardRef<HTMLButtonElement, DateTimePickerProps>(
  function DateTimePicker(
    { value, onChange, placeholder, id, disabled, className, ...props },
    ref,
  ) {
    const { t } = useTranslation()
    const [open, setOpen] = React.useState(false)
    const selected = parse(value)
    const hour = selected?.getHours() ?? 0
    const minute = selected?.getMinutes() ?? 0

    function handleSelectDate(date: Date | undefined) {
      if (!date) {
        onChange(undefined)
        return
      }
      onChange(combine(date, hour, minute))
    }

    function handleSelectHour(nextHour: string) {
      onChange(combine(selected ?? new Date(), Number(nextHour), minute))
    }

    function handleSelectMinute(nextMinute: string) {
      onChange(combine(selected ?? new Date(), hour, Number(nextMinute)))
    }

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
            <CalendarClock className="size-4 text-muted-foreground" />
            {selected ? formatDateTime(selected) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto gap-0 p-0">
          <Calendar
            mode="single"
            selected={selected ?? undefined}
            onSelect={handleSelectDate}
            disabled={disabled}
            autoFocus
          />
          <div className="flex items-center justify-center gap-2 border-t p-2">
            <Select
              value={String(hour).padStart(2, '0')}
              onValueChange={handleSelectHour}
              disabled={disabled}
            >
              <SelectTrigger size="sm" aria-label={t('common:dateTime.hour')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span aria-hidden="true" className="text-muted-foreground">
              :
            </span>
            <Select
              value={String(minute).padStart(2, '0')}
              onValueChange={handleSelectMinute}
              disabled={disabled}
            >
              <SelectTrigger size="sm" aria-label={t('common:dateTime.minute')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>
    )
  },
)
