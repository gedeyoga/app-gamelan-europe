import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}

// Search bar global untuk semua menu CRUD list.
// Controlled oleh page (debounce di page/hook), komponen ini murni presentational.
export function SearchBar({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: SearchBarProps) {
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('common:search.defaultPlaceholder')
  const resolvedAriaLabel = ariaLabel ?? t('common:search.defaultAriaLabel')
  return (
    <div className={cn('relative w-full max-w-sm', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedAriaLabel}
        role="searchbox"
        className="pr-8 pl-8"
      />
      {value.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('common:search.clear')}
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}
