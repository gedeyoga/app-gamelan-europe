import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
import type { SearchSelectOption } from '@/components/shared/search-select'
import { cn } from '@/lib/utils'

export interface CitySelectProps {
  options: SearchSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  isLoading?: boolean
  disabled?: boolean
  canCreate?: boolean
  onCreate: (name: string) => Promise<SearchSelectOption | undefined>
  createSearchPlaceholder: string
  addLabel: (name: string) => string
  creatingLabel: string
  className?: string
}

/**
 * Single-select combobox untuk kota + tambah inline (presentational).
 * `shouldFilter={false}` — filter manual agar baris "Add" tidak tersaring cmdk.
 * Opsi hasil create di-merge lokal (dedupe by value) supaya label value terpilih
 * langsung tampil tanpa menunggu refetch `['geo','cities']`.
 */
export function CitySelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  isLoading = false,
  disabled = false,
  canCreate = false,
  onCreate,
  createSearchPlaceholder,
  addLabel,
  creatingLabel,
  className,
}: CitySelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [extra, setExtra] = useState<SearchSelectOption[]>([])

  const merged = useMemo(() => {
    const seen = new Set(options.map((option) => option.value))
    return [...options, ...extra.filter((option) => !seen.has(option.value))]
  }, [options, extra])

  const selected = merged.find((option) => option.value === value)
  const term = search.trim().toLowerCase()
  const filtered = useMemo(
    () => merged.filter((option) => option.label.toLowerCase().includes(term)),
    [merged, term],
  )
  const canAddNew =
    canCreate && term.length > 0 && !merged.some((option) => option.label.trim().toLowerCase() === term)

  async function handleCreate() {
    const name = search.trim()
    if (!name) return
    setIsCreating(true)
    try {
      const created = await onCreate(name)
      if (created) {
        setExtra((prev) => (prev.some((option) => option.value === created.value) ? prev : [...prev, created]))
        onChange(created.value)
        setSearch('')
        setOpen(false)
      }
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
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          {selected ? (
            <span className="truncate">{selected.label}</span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={canCreate ? createSearchPlaceholder : searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{canAddNew ? addLabel(search.trim()) : emptyLabel}</CommandEmpty>
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
              {canAddNew && (
                <CommandItem
                  value={`__create__${search.trim()}`}
                  disabled={isCreating}
                  onSelect={() => void handleCreate()}
                >
                  <Plus className="size-4" />
                  {isCreating ? creatingLabel : addLabel(search.trim())}
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
