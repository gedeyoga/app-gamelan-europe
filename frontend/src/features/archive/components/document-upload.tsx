import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ExternalLink, FileText, GripVertical, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useFileDrop } from '@/lib/use-file-drop'
import { cn } from '@/lib/utils'

import { formatFileSize } from '../lib/format-file-size'
import type { ArchiveDocument } from '../types'

const PDF_MIME = 'application/pdf'
const MAX_SIZE_BYTES = 10 * 1024 * 1024

function isPdf(file: File): boolean {
  return file.type === PDF_MIME || /\.pdf$/i.test(file.name)
}

export interface DocumentUploadProps {
  /** Dokumen berurut — urutan array = urutan kirim (`documentIds`). */
  value: ArchiveDocument[]
  onChange: (next: ArchiveDocument[]) => void
  /** Dipanggil per file valid; parent yang mengunggah & append ke `value`. */
  onUpload: (file: File) => void
  isUploading?: boolean
  /** Pesan error API non-422 dari parent. */
  error?: string | null
  disabled?: boolean
  className?: string
}

export function DocumentUpload({
  value,
  onChange,
  onUpload,
  isUploading = false,
  error,
  disabled = false,
  className,
}: DocumentUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

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

  function validate(file: File): string | null {
    if (!isPdf(file)) return t('archive:document.uploadInvalid')
    if (file.size > MAX_SIZE_BYTES) return t('archive:document.uploadTooLarge')
    return null
  }

  function handleFiles(files: File[]) {
    let firstError: string | null = null
    const valid: File[] = []
    for (const file of files) {
      const message = validate(file)
      if (message) {
        firstError ??= message
        continue
      }
      valid.push(file)
    }
    setInvalidMessage(firstError)
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
        multiple
        accept="application/pdf,.pdf"
        disabled={disabled || isUploading}
        className="hidden"
        onChange={(event) => {
          handleFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          {t('archive:document.empty')}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((document, index) => (
            <li
              key={document.id}
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
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 p-2 text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <FileText className="size-8 shrink-0" aria-hidden="true" />
                <span className="w-full truncate px-1 text-center text-xs font-medium text-foreground">
                  {document.filename}
                </span>
                <span className="text-xs">{formatFileSize(document.size)}</span>
              </a>
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
                  disabled={disabled || isUploading}
                  aria-label={t('archive:document.open')}
                  title={t('archive:document.open')}
                  asChild
                >
                  <a href={document.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={disabled || isUploading || index === 0}
                  aria-label={t('archive:document.moveUp')}
                  title={t('archive:document.moveUp')}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={disabled || isUploading || index === value.length - 1}
                  aria-label={t('archive:document.moveDown')}
                  title={t('archive:document.moveDown')}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={disabled || isUploading}
                  aria-label={t('archive:document.remove')}
                  title={t('archive:document.remove')}
                  onClick={() => onChange(value.filter((item) => item.id !== document.id))}
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
          <Upload className="size-4" data-icon="inline-start" />
          {isUploading ? t('archive:document.uploading') : t('archive:document.add')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('archive:document.formats')}</p>

      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  )
}
