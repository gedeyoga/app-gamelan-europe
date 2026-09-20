import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface PhoneCodeOption {
  dial: string
  name: string
  emoji?: string | null
  /** Opsional agar pencarian bisa mencocokkan kode negara ISO2. */
  iso2?: string
}

export interface PhoneCodeComboboxProps {
  options: PhoneCodeOption[]
  value: string
  onChange: (dial: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  /** Tandai trigger invalid + hubungkan pesan error field phone. */
  invalid?: boolean
  describedBy?: string
}

/**
 * Combobox dial code negara (presentational). Filter diserahkan ke cmdk via
 * `value` gabungan nama + iso2 + dial; daftar dibatasi tinggi agar scroll.
 */
export function PhoneCodeCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  invalid,
  describedBy,
}: PhoneCodeComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.dial === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="w-[7.5rem] shrink-0 justify-between px-2"
        >
          {selected ? (
            <span className="truncate">
              {selected.emoji ? `${selected.emoji} ` : ''}+{selected.dial}
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.dial}
                  value={`${option.name} ${option.iso2 ?? ''} ${option.dial} +${option.dial}`}
                  data-checked={option.dial === value}
                  onSelect={() => {
                    onChange(option.dial)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">
                    {option.emoji ? `${option.emoji} ` : ''}
                    {option.name}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    +{option.dial}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
