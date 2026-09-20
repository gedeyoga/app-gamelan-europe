import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

import type { UploadedImage } from '../types'

export interface StoryGalleryProps {
  images: UploadedImage[]
  className?: string
}

function largeUrl(image: UploadedImage): string {
  return image.variants.find((variant) => variant.name === 'large')?.url ?? image.url
}

function thumbnailUrl(image: UploadedImage): string {
  return image.variants.find((variant) => variant.name === 'thumbnail')?.url ?? image.url
}

// Galeri read-only + lightbox; mirror preview `Dialog` di `gallery-upload.tsx`.
export function StoryGallery({ images, className }: StoryGalleryProps) {
  const { t } = useTranslation()
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  function go(delta: number) {
    if (previewIndex === null) return
    setPreviewIndex((previewIndex + delta + images.length) % images.length)
  }

  const active = previewIndex !== null ? images[previewIndex] : undefined

  return (
    <>
      <ul className={cn('grid grid-cols-2 gap-2 md:grid-cols-3', className)}>
        {images.map((image, index) => (
          <li key={image.id}>
            <button
              type="button"
              className="block w-full cursor-zoom-in overflow-hidden rounded-lg border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => setPreviewIndex(index)}
              aria-label={t('story:gallery.preview')}
              title={t('story:gallery.preview')}
            >
              <img
                src={thumbnailUrl(image)}
                alt={image.filename}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

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
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{t('story:gallery.previewTitle')}</DialogTitle>
                <DialogDescription>
                  {active.filename} ·{' '}
                  {t('story:gallery.counter', {
                    current: (previewIndex ?? 0) + 1,
                    total: images.length,
                  })}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => go(-1)}
                  aria-label={t('story:gallery.previous')}
                  title={t('story:gallery.previous')}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <img
                  src={largeUrl(active)}
                  alt={active.filename}
                  className="max-h-[70vh] w-auto object-contain"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => go(1)}
                  aria-label={t('story:gallery.next')}
                  title={t('story:gallery.next')}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
