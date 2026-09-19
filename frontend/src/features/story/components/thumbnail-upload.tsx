import { useRef, useState } from 'react'
import { ImageUp, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useFileDrop } from '../lib/use-file-drop'

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
  className,
}: ThumbnailUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null)

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    validateAndUpload(file)
  }

  function validateAndUpload(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_SIZE_BYTES) {
      setInvalidMessage(t('story:thumbnail.uploadInvalid'))
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
            'relative overflow-hidden rounded-lg border',
            isDragging && 'ring-2 ring-primary',
          )}
        >
          <img
            src={previewUrl ?? value}
            alt={t('story:form.thumbnail')}
            className="aspect-video w-full object-cover"
          />
        </div>
      ) : (
        <button
          type="button"
          aria-label={t('story:thumbnail.upload')}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className={cn(
            'flex aspect-video w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50',
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
          {isUploading ? t('story:thumbnail.uploading') : t('story:thumbnail.upload')}
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
            {t('story:thumbnail.remove')}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t('story:thumbnail.formats')}</p>

      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  )
}
