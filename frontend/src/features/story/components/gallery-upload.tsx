import { useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImageUp,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { useFileDrop } from '@/lib/use-file-drop'
import type { UploadedImage } from '../types'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export interface GalleryUploadProps {
  /** Galeri berurut — urutan array = urutan tampil. */
  value: UploadedImage[]
  onChange: (next: UploadedImage[]) => void
  /** Dipanggil per file valid; parent yang mengunggah & append ke `value`. */
  onUpload: (file: File) => void
  isUploading?: boolean
  /** Pesan error API non-422 dari parent. */
  error?: string | null
  disabled?: boolean
  /** Namespace i18n (`story:<prefix>.X`); default galeri. */
  i18nPrefix?: 'gallery' | 'flyer'
  className?: string
}

export function GalleryUpload({
  value,
  onChange,
  onUpload,
  isUploading = false,
  error,
  disabled = false,
  i18nPrefix = 'gallery',
  className,
}: GalleryUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= value.length) return
    const next = value.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  function resetDrag() {
    setDragIndex(null)
    setOverIndex(null)
  }

  function go(delta: number) {
    if (previewIndex === null || value.length === 0) return
    setPreviewIndex((previewIndex + delta + value.length) % value.length)
  }

  function handleFiles(files: File[]) {
    const valid = files.filter(
      (file) => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_SIZE_BYTES,
    )
    setInvalidMessage(valid.length === files.length ? null : t(`story:${i18nPrefix}.uploadInvalid`))
    for (const file of valid) onUpload(file)
  }

  const { isDragging, dropHandlers } = useFileDrop(handleFiles, disabled || isUploading)

  const message = invalidMessage ?? error

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg',
        isDragging && 'ring-2 ring-primary',
        className,
      )}
      {...dropHandlers}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        disabled={disabled || isUploading}
        className="hidden"
        onChange={(event) => {
          handleFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          {t(`story:${i18nPrefix}.empty`)}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((image, index) => (
            <li
              key={image.id}
              draggable={!disabled}
              onDragStart={(event) => {
                setDragIndex(index)
                event.dataTransfer.setData('text/plain', String(index))
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setOverIndex(index)
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (disabled) {
                  resetDrag()
                  return
                }
                // Firefox: state dragIndex tidak reliabel antar-elemen → baca dari dataTransfer.
                const raw = event.dataTransfer.getData('text/plain')
                const from = raw === '' ? dragIndex : Number.parseInt(raw, 10)
                if (from !== null && Number.isInteger(from)) move(from, index)
                resetDrag()
              }}
              onDragEnd={resetDrag}
              className={cn(
                'relative overflow-hidden rounded-md border bg-card',
                dragIndex === index && 'opacity-50',
                overIndex === index && dragIndex !== index && 'ring-2 ring-primary',
              )}
            >
              <button
                type="button"
                className="block w-full cursor-zoom-in"
                onClick={() => setPreviewIndex(index)}
                aria-label={t(`story:${i18nPrefix}.preview`)}
                title={t(`story:${i18nPrefix}.preview`)}
              >
                <img
                  src={
                    image.variants.find((variant) => variant.name === 'thumbnail')?.url ?? image.url
                  }
                  alt={image.filename}
                  className="aspect-square w-full object-cover"
                />
              </button>
              <span className="absolute top-1 left-1 flex size-5 items-center justify-center rounded bg-background/80 text-xs text-muted-foreground">
                {index + 1}
              </span>
              <GripVertical
                className="absolute top-1 right-1 size-4 cursor-grab text-muted-foreground"
                aria-hidden="true"
              />
              <div className="flex items-center justify-end gap-0.5 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={disabled || isUploading || index === 0}
                  onClick={() => move(index, index - 1)}
                  aria-label={t(`story:${i18nPrefix}.moveUp`)}
                  title={t(`story:${i18nPrefix}.moveUp`)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={disabled || isUploading || index === value.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={t(`story:${i18nPrefix}.moveDown`)}
                  title={t(`story:${i18nPrefix}.moveDown`)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={disabled || isUploading}
                  onClick={() => onChange(value.filter((item) => item.id !== image.id))}
                  aria-label={t(`story:${i18nPrefix}.remove`)}
                  title={t(`story:${i18nPrefix}.remove`)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
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
          {isUploading ? t(`story:${i18nPrefix}.uploading`) : t(`story:${i18nPrefix}.add`)}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t(`story:${i18nPrefix}.formats`)}</p>

      {message && <p className="text-xs text-destructive">{message}</p>}

      <Dialog
        open={previewIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewIndex(null)
        }}
      >
        <DialogContent
          className="max-w-3xl"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              go(-1)
            } else if (event.key === 'ArrowRight') {
              event.preventDefault()
              go(1)
            }
          }}
        >
          {previewIndex !== null && value[previewIndex] && (
            <>
              <DialogHeader>
                <DialogTitle>{t(`story:${i18nPrefix}.previewTitle`)}</DialogTitle>
                <DialogDescription>
                  {value[previewIndex].filename} ·{' '}
                  {t(`story:${i18nPrefix}.counter`, {
                    current: previewIndex + 1,
                    total: value.length,
                  })}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => go(-1)}
                  aria-label={t(`story:${i18nPrefix}.previous`)}
                  title={t(`story:${i18nPrefix}.previous`)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <img
                  src={
                    value[previewIndex].variants.find((variant) => variant.name === 'large')?.url ??
                    value[previewIndex].url
                  }
                  alt={value[previewIndex].filename}
                  className="max-h-[70vh] w-auto object-contain"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => go(1)}
                  aria-label={t(`story:${i18nPrefix}.next`)}
                  title={t(`story:${i18nPrefix}.next`)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

