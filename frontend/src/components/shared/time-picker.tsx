import * as React from 'react'
import { Clock, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export interface TimePickerProps
  extends Omit<React.ComponentProps<'button'>, 'onChange' | 'value' | 'id'> {
  /** "HH:mm" */
  value?: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  id?: string
}

function parse(value?: string): { hour: string; minute: string } | null {
  if (!value) return null
  const match = TIME_PATTERN.exec(value)
  return match ? { hour: match[1], minute: match[2] } : null
}

// Komponen presentational: pemilihan jam/menit via shadcn Popover + Select (native <input type="time"> dilarang).
// Kompatibel `<FormControl>`/`<FormItem>` (meneruskan `id`, `aria-*`, `disabled`, `ref` ke trigger Button).
// Tombol clear (X) tampil dalam popover hanya saat ada nilai; `onChange(undefined)`.
export const TimePicker = React.forwardRef<HTMLButtonElement, TimePickerProps>(function TimePicker(
  { value, onChange, placeholder, id, disabled, className, ...props },
  ref,
) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const parsed = parse(value)
  const hour = parsed?.hour ?? '00'
  const minute = parsed?.minute ?? '00'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={parsed === null}
          className={cn(
            'w-full justify-start gap-2 font-normal data-[empty=true]:text-muted-foreground',
            className,
          )}
          {...props}
        >
          <Clock className="size-4 text-muted-foreground" />
          {parsed ? `${parsed.hour}:${parsed.minute}` : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex items-center justify-center gap-2">
          <Select
            value={hour}
            onValueChange={(nextHour) => onChange(`${nextHour}:${minute}`)}
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
            value={minute}
            onValueChange={(nextMinute) => onChange(`${hour}:${nextMinute}`)}
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
          {parsed && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label={t('common:dateTime.clear')}
              title={t('common:dateTime.clear')}
              disabled={disabled}
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
})
