import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  CornerDownLeft,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  SquareCode,
  Strikethrough,
  Undo2,
} from 'lucide-react'

import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { isValidationError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

import type { UploadedImage } from '../types'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  /** `POST /images` — hasilnya disisipkan ke dokumen pada posisi cursor. */
  onUploadImage: (file: File) => Promise<UploadedImage>
  /** Laporkan id gambar yang berhasil diupload agar masuk `imageIds`. */
  onImageUploaded: (image: UploadedImage) => void
  /** Error upload non-422 (500/502/network) — parent yang toast. */
  onUploadError?: (error: unknown) => void
  disabled?: boolean
  /** Slot elemen di kiri toolbar (mis. tombol Batal). */
  leading?: React.ReactNode
  className?: string
}

export function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  onImageUploaded,
  onUploadError,
  disabled = false,
  leading,
  className,
}: RichTextEditorProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  // Indikator backend resize/kompresi, terpisah dari `isUploading` yang mengunci tombol.
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // Counter agar dragleave saat melewati child node tidak memicu flicker overlay.
  const dragDepth = useRef(0)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: t('story:editor.placeholder') }),
    ],
    content: value,
    editable: !disabled,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  })

  // Sinkron konten dari luar (mis. detail edit selesai dimuat).
  useEffect(() => {
    if (!editor) return
    if (value === editor.getHTML()) return
    editor.commands.setContent(value || '', { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  /**
   * Upload satu gambar lalu sisipkan ke dokumen.
   * `at` (posisi doc) diberikan untuk drop; tanpa `at` gambar disisipkan di cursor.
   * Mengembalikan posisi lanjutan agar insert multi-file berurutan tetap urut.
   */
  async function uploadAndInsert(file: File, at?: number): Promise<number | undefined> {
    if (!editor) return at
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_SIZE_BYTES) {
      setUploadError(t('story:editor.uploadInvalid'))
      return at
    }
    setUploadError(null)
    setIsUploading(true)
    setIsProcessing(true)
    try {
      const image = await onUploadImage(file)
      if (at === undefined) {
        editor.chain().focus().setImage({ src: image.url }).run()
      } else {
        editor.chain().insertContentAt(at, { type: 'image', attrs: { src: image.url } }).run()
        at += 1
      }
      onImageUploaded(image)
      return at
    } catch (error) {
      if (isValidationError(error)) {
        setUploadError(t('story:editor.uploadInvalid'))
      } else {
        onUploadError?.(error)
      }
      return at
    } finally {
      setIsUploading(false)
      setIsProcessing(false)
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await uploadAndInsert(file)
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    // `dataTransfer.files` kosong di luar dragstart/drop (protected mode, MDN).
    // `types` satu-satunya sinyal file drag yang andal di dragover.
    if (!event.dataTransfer.types.includes('Files')) return
    // Tetap preventDefault saat disabled agar browser tidak membuka file yang dijatuhkan.
    event.preventDefault()
    if (disabled) return
    event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return
    dragDepth.current += 1
    if (!disabled) setIsDragging(true)
  }

  function handleDragLeave() {
    // Tanpa guard `disabled`: counter tetap turun agar tidak macet saat disabled berubah.
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    // Drag `<img>` inline bisa menyertakan 'Files' di `types` tanpa file nyata.
    // files kosong → bukan file drop: jangan preventDefault, jangan proses.
    if (event.dataTransfer.files.length === 0) return
    // File drop nyata: blokir default (cegah browser membuka file) walau disabled.
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    if (disabled || isUploading) return
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      ACCEPTED_TYPES.includes(file.type),
    )
    if (files.length === 0) return
    let at = editor?.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
    for (const file of files) {
      at = await uploadAndInsert(file, at)
    }
  }

  function handleLink() {
    if (!editor) return
    const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
    const url = window.prompt(t('story:editor.link'), previous)
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-clip border bg-card lg:h-full lg:min-h-0',
        className,
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={(event) => void handleDrop(event)}
    >
      {isDragging && !disabled && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-none border-2 border-dashed border-primary bg-background/80 text-sm font-medium text-primary">
          {t('story:editor.dropHere')}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileChange}
      />
      <Toolbar
        editor={editor}
        disabled={disabled}
        isUploading={isUploading}
        leading={leading}
        onInsertImage={() => inputRef.current?.click()}
        onLink={handleLink}
      />
      <EditorContent
        editor={editor}
        className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto [&_.ProseMirror]:mx-auto [&_.ProseMirror]:max-w-4xl [&_.ProseMirror]:min-h-[60vh] [&_.ProseMirror]:px-6 [&_.ProseMirror]:py-8 [&_.ProseMirror]:text-base [&_.ProseMirror]:leading-7 [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_h2]:mt-8 [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h3]:mt-6 [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_p]:my-3 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 lg:[&_.ProseMirror]:min-h-full"
      />
      <div className="flex shrink-0 items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
        {/* `isProcessing` menandai upload berjalan (backend resize/kompresi); `isUploading` mengunci tombol. */}
        <span>{isProcessing ? t('story:editor.imageProcessing') : ''}</span>
        {uploadError && <span className="text-destructive">{uploadError}</span>}
      </div>
    </div>
  )
}

interface ToolbarProps {
  editor: Editor | null
  disabled: boolean
  isUploading: boolean
  leading?: React.ReactNode
  onInsertImage: () => void
  onLink: () => void
}

function Toolbar({ editor, disabled, isUploading, leading, onInsertImage, onLink }: ToolbarProps) {
  const { t } = useTranslation()
  if (!editor) return null
  const inactive = disabled

  const groupSeparator = <Separator orientation="vertical" className="mx-1 h-5" />

  return (
    <div className="relative flex w-full shrink-0 flex-wrap items-center justify-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
      {leading && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2">{leading}</div>
      )}
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => editor.chain().focus().undo().run()}
        disabled={inactive || !editor.can().chain().focus().undo().run()}
        aria-label={t('story:editor.undo')}
      >
        <Undo2 className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => editor.chain().focus().redo().run()}
        disabled={inactive || !editor.can().chain().focus().redo().run()}
        aria-label={t('story:editor.redo')}
      >
        <Redo2 className="size-4" />
      </Toggle>
      {groupSeparator}
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        disabled={inactive}
        aria-label={t('story:editor.bold')}
      >
        <Bold className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        disabled={inactive}
        aria-label={t('story:editor.italic')}
      >
        <Italic className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('strike')}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        disabled={inactive}
        aria-label={t('story:editor.strike')}
      >
        <Strikethrough className="size-4" />
      </Toggle>
      {groupSeparator}
      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 2 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={inactive}
        aria-label={t('story:editor.h2')}
      >
        <Heading2 className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 3 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={inactive}
        aria-label={t('story:editor.h3')}
      >
        <Heading3 className="size-4" />
      </Toggle>
      {groupSeparator}
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'left' })}
        onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
        disabled={inactive}
        aria-label={t('story:editor.alignLeft')}
      >
        <AlignLeft className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'center' })}
        onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
        disabled={inactive}
        aria-label={t('story:editor.alignCenter')}
      >
        <AlignCenter className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: 'right' })}
        onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
        disabled={inactive}
        aria-label={t('story:editor.alignRight')}
      >
        <AlignRight className="size-4" />
      </Toggle>
      {groupSeparator}
      <Toggle
        size="sm"
        pressed={editor.isActive('bulletList')}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        disabled={inactive}
        aria-label={t('story:editor.bulletList')}
      >
        <List className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('orderedList')}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        disabled={inactive}
        aria-label={t('story:editor.orderedList')}
      >
        <ListOrdered className="size-4" />
      </Toggle>
      {groupSeparator}
      <Toggle
        size="sm"
        pressed={editor.isActive('blockquote')}
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
        disabled={inactive}
        aria-label={t('story:editor.blockquote')}
      >
        <Quote className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('codeBlock')}
        onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
        disabled={inactive}
        aria-label={t('story:editor.codeBlock')}
      >
        <SquareCode className="size-4" />
      </Toggle>
      {groupSeparator}
      <Toggle
        size="sm"
        pressed={editor.isActive('code')}
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        disabled={inactive}
        aria-label={t('story:editor.inlineCode')}
      >
        <Code className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => editor.chain().focus().setHorizontalRule().run()}
        disabled={inactive}
        aria-label={t('story:editor.horizontalRule')}
      >
        <Minus className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => editor.chain().focus().setHardBreak().run()}
        disabled={inactive}
        aria-label={t('story:editor.hardBreak')}
      >
        <CornerDownLeft className="size-4" />
      </Toggle>
      {groupSeparator}
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        disabled={inactive}
        aria-label={t('story:editor.clearFormat')}
      >
        <RemoveFormatting className="size-4" />
      </Toggle>
      {groupSeparator}
      <Toggle
        size="sm"
        pressed={editor.isActive('link')}
        onPressedChange={onLink}
        disabled={inactive}
        aria-label={t('story:editor.link')}
      >
        <Link2 className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={onInsertImage}
        disabled={inactive || isUploading}
        aria-label={isUploading ? t('story:editor.uploading') : t('story:editor.uploadImage')}
      >
        <ImagePlus className="size-4" />
      </Toggle>
    </div>
  )
}
