import { useRef, useState } from 'react'
import { ImageUp, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useFileDrop } from '@/lib/use-file-drop'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export interface ThumbnailUploadProps {
  value: string | null
  /** URL varian `thumbnail` bila ada; fallback ke `value`. */
  previewUrl?: string | null
  isUploading?: boolean
  /** Pesan error API non-422 dari parent (bukan error guard FE). */
  error?: string | null
  disabled?: boolean
  onUpload: (file: File) => void
  onRemove: () => void
  /** Namespace i18n; default `story` (dipakai archive lewat `archive`). */
  i18nPrefix?: string
  /** Bentuk pratinjau; default `video` (konsumen lama tidak berubah). */
  shape?: 'video' | 'circle'
  className?: string
}

export function ThumbnailUpload({
  value,
  previewUrl,
  isUploading = false,
  error,
  disabled = false,
  onUpload,
  onRemove,
  i18nPrefix = 'story',
  shape = 'video',
  className,
}: ThumbnailUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null)
  const isCircle = shape === 'circle'
  const aspectClass = isCircle ? 'aspect-square' : 'aspect-video'
  const radiusClass = isCircle ? 'rounded-full' : 'rounded-lg'

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    validateAndUpload(file)
  }

  function validateAndUpload(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_SIZE_BYTES) {
      setInvalidMessage(t(`${i18nPrefix}:thumbnail.uploadInvalid`))
      return
    }
    setInvalidMessage(null)
    onUpload(file)
  }

  function handleFiles(files: File[]) {
    const file = files[0]
    if (file) validateAndUpload(file)
  }

  const { isDragging, dropHandlers } = useFileDrop(handleFiles, disabled || isUploading)

  const message = invalidMessage ?? error

  return (
    <div className={cn('flex flex-col gap-2', className)} {...dropHandlers}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        disabled={disabled || isUploading}
        className="hidden"
        onChange={handleFileChange}
      />
      {value ? (
        <div
          className={cn(
            'relative overflow-hidden border',
            radiusClass,
            isDragging && 'ring-2 ring-primary',
          )}
        >
          <img
            src={previewUrl ?? value}
            alt={t(`${i18nPrefix}:form.thumbnail`)}
            className={cn('w-full object-cover', aspectClass)}
          />
        </div>
      ) : (
        <button
          type="button"
          aria-label={t(`${i18nPrefix}:thumbnail.upload`)}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className={cn(
            'flex w-full items-center justify-center border border-dashed text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50',
            aspectClass,
            radiusClass,
            isDragging && 'border-primary bg-muted/50',
          )}
        >
          <ImageUp className="size-5" />
        </button>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp className="size-4" data-icon="inline-start" />
          {isUploading ? t(`${i18nPrefix}:thumbnail.uploading`) : t(`${i18nPrefix}:thumbnail.upload`)}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isUploading}
            onClick={onRemove}
          >
            <Trash2 className="size-4" data-icon="inline-start" />
            {t(`${i18nPrefix}:thumbnail.remove`)}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t(`${i18nPrefix}:thumbnail.formats`)}</p>

      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  )
}
