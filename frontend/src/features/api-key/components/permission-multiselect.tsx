import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { Permission } from '@/features/permission/types'
import { cn } from '@/lib/utils'

export interface PermissionMultiSelectProps {
  /** Kode permission terpilih (`resource:action`). */
  value: string[]
  onChange: (codes: string[]) => void
  permissions: Permission[]
  isPending?: boolean
  /** Pesan error pemuatan daftar (GET /permissions). */
  error?: string | null
  disabled?: boolean
  className?: string
}

/**
 * Multi-pilih permission untuk form API key.
 * Presentasional — daftar permission di-inject container (`usePermissions`),
 * bukan fetch di komponen. Pencarian difilter client-side (kode/deskripsi).
 */
export function PermissionMultiSelect({
  value,
  onChange,
  permissions,
  isPending = false,
  error,
  disabled = false,
  className,
}: PermissionMultiSelectProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const filtered = permissions.filter(
    (permission) =>
      permission.code.toLowerCase().includes(query) ||
      permission.description?.toLowerCase().includes(query),
  )

  function selectAllFiltered() {
    onChange(Array.from(new Set([...value, ...filtered.map((p) => p.code)])))
  }

  function clearAllFiltered() {
    const ids = new Set(filtered.map((p) => p.code))
    onChange(value.filter((code) => !ids.has(code)))
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={selectAllFiltered}
          disabled={filtered.length === 0 || disabled}
        >
          <Plus data-icon="inline-start" className="size-4" />
          {t('api-key:form.selectAll')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearAllFiltered}
          disabled={filtered.length === 0 || disabled}
        >
          <Trash2 data-icon="inline-start" className="size-4" />
          {t('api-key:form.clearAll')}
        </Button>
      </div>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('api-key:form.searchPermissions')}
        aria-label={t('api-key:form.searchPermissionsAria')}
      />
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('api-key:form.noPermissions')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('api-key:form.noMatch')}</p>
        ) : (
          filtered.map((permission) => (
            <label
              key={permission.id}
              className="flex cursor-pointer items-start gap-3 rounded-md p-1 hover:bg-muted"
            >
              <Checkbox
                checked={value.includes(permission.code)}
                onCheckedChange={() =>
                  onChange(
                    value.includes(permission.code)
                      ? value.filter((code) => code !== permission.code)
                      : [...value, permission.code],
                  )
                }
                disabled={disabled}
              />
              <span className="min-w-0">
                <span className="block font-mono text-sm font-medium">{permission.code}</span>
                {permission.description && (
                  <span className="block text-sm text-muted-foreground">
                    — {permission.description}
                  </span>
                )}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}
