import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react'
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

/** Bentuk minimal user yang dibutuhkan combobox. */
export interface UserOption {
  id: string
  fullName: string
  /** Fallback label bila `fullName` kosong. */
  email?: string
}

export interface UserComboboxProps {
  options: UserOption[]
  value: string[]
  onChange: (ids: string[]) => void
  isLoading?: boolean
  disabled?: boolean
  className?: string
  /** Dipanggil saat tombol tambah diklik (buka dialog create user). */
  onCreateClick?: () => void
  /** Gate `user:create` — tombol tambah author disembunyikan bila `false`. */
  canCreate?: boolean
  /** Predikat per opsi: tampilkan aksi hapus bila true. */
  canDeleteOption?: (option: UserOption) => boolean
  /** Dipanggil saat aksi hapus pada satu opsi diklik. */
  onDeleteOption?: (option: UserOption) => void
}

function labelOf(option: UserOption): string {
  return option.fullName.trim() || option.email?.trim() || option.id
}

export function UserCombobox({
  options,
  value,
  onChange,
  isLoading = false,
  disabled = false,
  className,
  onCreateClick,
  canCreate = false,
  canDeleteOption,
  onDeleteOption,
}: UserComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = useMemo(
    () => options.filter((option) => value.includes(option.id)),
    [options, value],
  )

  const term = search.trim().toLowerCase()
  const filtered = useMemo(
    () => options.filter((option) => labelOf(option).toLowerCase().includes(term)),
    [options, term],
  )

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((item) => item !== id))
    else onChange([...value, id])
  }

  return (
    <div className="flex w-full items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('h-auto min-h-9 w-full min-w-0 flex-1 justify-between py-1.5', className)}
          >
            <span className="flex flex-wrap gap-1">
              {selected.length === 0 ? (
                <span className="text-muted-foreground">{t('common:combobox.userPlaceholder')}</span>
              ) : (
                selected.map((user) => (
                  <Badge key={user.id} variant="secondary">
                    {labelOf(user)}
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
              placeholder={t('common:combobox.userSearch')}
            />
            <CommandList>
              <CommandEmpty>{t('common:combobox.userEmpty')}</CommandEmpty>
              <CommandGroup>
                {filtered.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => toggle(option.id)}
                    className="pr-1.5 [&>svg:last-child]:hidden"
                  >
                    <Check
                      className={cn(
                        'size-4',
                        value.includes(option.id) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {labelOf(option)}
                    {canDeleteOption?.(option) && onDeleteOption && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-6 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={t('user:deleteAuthor.optionLabel', { name: labelOf(option) })}
                        title={t('user:deleteAuthor.optionLabel', { name: labelOf(option) })}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteOption(option)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </CommandItem>
                ))}
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
      {canCreate && onCreateClick && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={disabled}
          onClick={onCreateClick}
          aria-label={t('user:addAuthor')}
          title={t('user:addAuthor')}
        >
          <Plus className="size-4" />
        </Button>
      )}
    </div>
  )
}
