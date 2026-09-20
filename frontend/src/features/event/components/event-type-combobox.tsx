import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
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
import { cn } from '@/lib/utils'

import type { EventType } from '../types'

export interface EventTypeComboboxProps {
  options: EventType[]
  value: string[]
  onChange: (ids: string[]) => void
  isLoading?: boolean
  disabled?: boolean
  /** Gate `event:create` — input tambah tipe event disembunyikan bila `false`. */
  canCreate?: boolean
  onCreate: (name: string) => Promise<EventType | undefined>
  className?: string
}

export function EventTypeCombobox({
  options,
  value,
  onChange,
  isLoading = false,
  disabled = false,
  canCreate = false,
  onCreate,
  className,
}: EventTypeComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const selected = useMemo(
    () => options.filter((option) => value.includes(option.id)),
    [options, value],
  )

  const term = search.trim().toLowerCase()
  const filtered = useMemo(
    () => options.filter((option) => option.name.toLowerCase().includes(term)),
    [options, term],
  )
  const canAddNew =
    canCreate && term.length > 0 && !options.some((option) => option.name.toLowerCase() === term)

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((item) => item !== id))
    else onChange([...value, id])
  }

  async function handleCreate() {
    const name = search.trim()
    if (!name) return
    setIsCreating(true)
    try {
      const created = await onCreate(name)
      if (created && !value.includes(created.id)) onChange([...value, created.id])
      setSearch('')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-auto min-h-9 w-full justify-between py-1.5', className)}
        >
          <span className="flex flex-wrap gap-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{t('event:form.eventTypePlaceholder')}</span>
            ) : (
              selected.map((eventType) => (
                <Badge key={eventType.id} variant="secondary">
                  {eventType.name}
                </Badge>
              ))
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t('event:form.eventTypeSearch')}
          />
          <CommandList>
            <CommandEmpty>
              {canAddNew
                ? t('event:form.eventTypeAdd', { name: search.trim() })
                : t('event:form.eventTypeEmpty')}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem key={option.id} value={option.id} onSelect={() => toggle(option.id)}>
                  <Check
                    className={cn(
                      'size-4',
                      value.includes(option.id) ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
              {canAddNew && (
                <CommandItem
                  value={`__create__${search.trim()}`}
                  disabled={isCreating}
                  onSelect={() => void handleCreate()}
                >
                  <Plus className="size-4" />
                  {isCreating
                    ? t('event:form.eventTypeCreating')
                    : t('event:form.eventTypeAdd', { name: search.trim() })}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
        {isLoading && (
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            {t('common:actions.loading')}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
