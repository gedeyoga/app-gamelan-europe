import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface ExternalLinksInputProps {
  /** Daftar URL berurut — urutan array = urutan tampil. */
  value: string[]
  onChange: (next: string[]) => void
  /** Pesan validasi (mis. dari zod) dari parent. */
  error?: string | null
  disabled?: boolean
  className?: string
}

export function ExternalLinksInput({
  value,
  onChange,
  error,
  disabled = false,
  className,
}: ExternalLinksInputProps) {
  const { t } = useTranslation()

  function update(index: number, next: string) {
    onChange(value.map((item, i) => (i === index ? next : item)))
  }

  function add() {
    onChange([...value, ''])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('archive:form.externalLinksEmpty')}</p>
      )}

      {value.map((link, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            type="url"
            value={link}
            disabled={disabled}
            placeholder={t('archive:form.externalLinksPlaceholder')}
            aria-label={t('archive:form.externalLinksPlaceholder')}
            onChange={(event) => update(index, event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={t('archive:form.externalLinksRemove')}
            title={t('archive:form.externalLinksRemove')}
            onClick={() => remove(index)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className="self-start"
        onClick={add}
      >
        <Plus className="size-4" data-icon="inline-start" />
        {t('archive:form.externalLinksAdd')}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
