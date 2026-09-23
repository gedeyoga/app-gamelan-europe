import { ExternalLink, FileText, ImageOff, Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'

import { formatFileSize } from '../lib/format-file-size'
import { STATUS_VARIANT, TYPE_VARIANT } from './status-variant'
import type { Archive } from '../types'

export interface ArchiveDetailProps {
  archive: Archive
  className?: string
}

// Layout "katalog dokumen": panel metadata sticky KIRI (lg) + konten utama KANAN.
// Mobile: judul dulu, lalu cover/metadata, baru isi — satu kolom.
export function ArchiveDetail({ archive, className }: ArchiveDetailProps) {
  const { t } = useTranslation()
  const hasLinks = archive.externalLinks.length > 0
  const documents = archive.documents ?? []
  const hasDocuments = documents.length > 0
  const hasCategories = archive.categories.length > 0

  return (
    <article className={cn('flex flex-col', className)}>
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[18rem_1fr] lg:gap-8">
        <header className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{archive.name}</h1>
        </header>

        <aside
          className={cn(
            'flex flex-col',
            'lg:sticky lg:top-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start',
          )}
        >
          <Card size="sm" className="overflow-hidden">
            {archive.thumbnail ? (
              <img
                src={archive.thumbnail}
                alt={archive.name}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
                <ImageOff className="size-6" aria-hidden="true" />
              </div>
            )}

            <CardHeader>
              <CardTitle>{t('archive:detail.metadata')}</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t('archive:detail.type')}</span>
                <Badge variant={TYPE_VARIANT[archive.type]}>
                  {t(`archive:typeOptions.${archive.type}`, { defaultValue: archive.type })}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t('archive:detail.status')}</span>
                <Badge variant={STATUS_VARIANT[archive.status]}>
                  {t(`archive:statusOptions.${archive.status}`, { defaultValue: archive.status })}
                </Badge>
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">
                  {t('archive:detail.categories')}
                </span>
                {hasCategories ? (
                  <div className="flex flex-wrap gap-1">
                    {archive.categories.map((category) => (
                      <Badge key={category.id} variant="secondary">
                        {category.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm">—</span>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t('archive:detail.creator')}</span>
                <span className="min-w-0 truncate text-sm">
                  {archive.creator?.fullName ?? '—'}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {t('archive:detail.publishedAt')}
                </span>
                <span className="text-sm">{formatDateTime(archive.publishedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="flex flex-col gap-6 lg:col-start-2 lg:row-start-2">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t('archive:form.descriptionLabel')}</h2>
            {archive.description ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{archive.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('archive:detail.empty')}</p>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t('archive:detail.externalLinks')}</h2>
            {hasLinks ? (
              <ul className="flex flex-wrap gap-2">
                {archive.externalLinks.map((link, index) => (
                  <li key={`${link}-${index}`} className="max-w-full">
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-accent"
                    >
                      <Link2
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 truncate text-primary">{link}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('archive:detail.empty')}</p>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t('archive:detail.documents')}</h2>
            {hasDocuments ? (
              <ul className="divide-y overflow-hidden rounded-lg border">
                {documents.map((document, index) => (
                  <li key={document.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
                      <span className="sr-only">{t('archive:detail.index')} </span>
                      {index + 1}
                    </span>
                    <FileText
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{document.filename}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatFileSize(document.size)}
                    </span>
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      {t('archive:document.open')}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('archive:detail.empty')}</p>
            )}
          </section>
        </div>
      </div>
    </article>
  )
}
