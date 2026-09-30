import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { GalleryUpload } from './gallery-upload'
import { labelForType, PRESET_TYPES, presetTypeId } from '../lib/flyer-type'
import type { FlyerGroup } from '../types'

const MAX_TYPE_LENGTH = 40

function normalize(type: string) {
  return type.trim().toLowerCase()
}

export interface FlyerMediaPanelProps {
  /** Grup flyer berurut; urutan array = urutan blok. */
  groups: FlyerGroup[]
  onChange: (next: FlyerGroup[]) => void
  /** Dipanggil per file valid; parent mengunggah & append ke grup `type`. */
  onUpload: (type: string, file: File) => void
  /** Tipe grup yang sedang mengunggah, bila ada. */
  uploadingType?: string | null
  /** Pesan error API non-422 per tipe grup. */
  errors?: Record<string, string | null | undefined>
  disabled?: boolean
  className?: string
}

// Blok media flyer bertipe: chip pemilih tipe → satu `GalleryUpload` per tipe terpilih.
export function FlyerMediaPanel({
  groups,
  onChange,
  onUpload,
  uploadingType = null,
  errors,
  disabled = false,
  className,
}: FlyerMediaPanelProps) {
  const { t } = useTranslation()
  const [customType, setCustomType] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)
  const [pendingRemoveType, setPendingRemoveType] = useState<string | null>(null)

  function findGroup(type: string) {
    return groups.find((group) => normalize(group.type) === normalize(type))
  }

  function removeGroup(type: string) {
    onChange(groups.filter((group) => normalize(group.type) !== normalize(type)))
  }

  function toggleType(type: string) {
    if (findGroup(type)) {
      const group = findGroup(type)
      if (group && group.images.length > 0) {
        setPendingRemoveType(group.type)
        return
      }
      removeGroup(type)
      return
    }
    onChange([...groups, { type, images: [] }])
  }

  function setGroupImages(type: string, images: FlyerGroup['images']) {
    onChange(
      groups.map((group) =>
        normalize(group.type) === normalize(type) ? { ...group, images } : group,
      ),
    )
  }

  function handleAddType() {
    const value = customType.trim()
    if (value.length === 0 || value.length > MAX_TYPE_LENGTH) return
    // Input yang cocok id preset ATAU label preset (locale aktif) → pakai id stabil (hindari chip duplikat).
    const resolved =
      presetTypeId(value) ??
      PRESET_TYPES.find((key) => normalize(t(`story:flyer.presets.${key}`)) === normalize(value)) ??
      value
    if (groups.some((group) => normalize(group.type) === normalize(resolved))) {
      setCustomError(t('story:flyer.duplicateType'))
      return
    }
    setCustomError(null)
    setCustomType('')
    onChange([...groups, { type: resolved, images: [] }])
  }

  const customGroups = groups.filter((group) => presetTypeId(group.type) === null)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" id="flyer-type-label">
          {t('story:flyer.typeLabel')}
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="flyer-type-label">
          {PRESET_TYPES.map((key) => {
            const checked = Boolean(findGroup(key))
            return (
              <Button
                key={key}
                type="button"
                variant={checked ? 'default' : 'outline'}
                size="sm"
                aria-pressed={checked}
                disabled={disabled}
                onClick={() => toggleType(key)}
              >
                {checked ? (
                  <Check className="size-4" data-icon="inline-start" />
                ) : (
                  <Plus className="size-4" data-icon="inline-start" />
                )}
                {t(`story:flyer.presets.${key}`)}
              </Button>
            )
          })}
          {customGroups.map((group, index) => (
            <Button
              key={`${group.type}-${index}`}
              type="button"
              variant="default"
              size="sm"
              aria-pressed
              disabled={disabled}
              onClick={() => toggleType(group.type)}
            >
              <Check className="size-4" data-icon="inline-start" />
              {group.type}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={customType}
            maxLength={MAX_TYPE_LENGTH}
            placeholder={t('story:flyer.customTypePlaceholder')}
            disabled={disabled}
            aria-label={t('story:flyer.customTypePlaceholder')}
            aria-invalid={Boolean(customError)}
            onChange={(event) => {
              setCustomType(event.target.value)
              setCustomError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddType()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || customType.trim().length === 0}
            onClick={handleAddType}
          >
            <Plus className="size-4" data-icon="inline-start" />
            {t('story:flyer.addType')}
          </Button>
        </div>
        {customError && <p className="text-xs text-destructive">{customError}</p>}
      </div>

      {groups.map((group, index) => {
        const headingId = `flyer-group-${group.type}-${index}`
        return (
          <div
            key={`${group.type}-${index}`}
            role="group"
            aria-labelledby={headingId}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium" id={headingId}>
                {labelForType(group.type, t)}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={disabled}
                onClick={() => toggleType(group.type)}
                aria-label={t('story:flyer.removeType')}
                title={t('story:flyer.removeType')}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <GalleryUpload
              i18nPrefix="flyer"
              value={group.images}
              onChange={(next) => setGroupImages(group.type, next)}
              onUpload={(file) => onUpload(group.type, file)}
              isUploading={uploadingType === group.type}
              error={errors?.[group.type]}
              disabled={disabled}
            />
          </div>
        )
      })}

      <AlertDialog
        open={pendingRemoveType !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveType(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('story:flyer.removeTypeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('story:flyer.removeTypeConfirmDescription', { type: pendingRemoveType ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRemoveType(null)}>
              <X className="size-4" data-icon="inline-start" />
              {t('story:flyer.removeTypeConfirmCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoveType) removeGroup(pendingRemoveType)
                setPendingRemoveType(null)
              }}
            >
              <Check className="size-4" data-icon="inline-start" />
              {t('story:flyer.removeTypeConfirmConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
