export type ArchiveType = 'MEMBER' | 'PUBLIC'

export type ArchiveStatus = 'DRAFT' | 'REQUEST' | 'APPROVED' | 'PUBLISHED'

export type ArchiveFormAction =
  | 'save'
  | 'draft'
  | 'request'
  | 'publish'
  | 'approve'
  | 'reject'
  | 'unpublish'

export type CategoryType = 'STORY' | 'ARCHIVE'

export interface ArchiveCategory {
  id: string
  name: string
  type: CategoryType
}

export interface ArchiveCreator {
  id: string
  fullName: string
}

export type { ImageVariant, ImageVariantName, UploadedImage } from '@/types/image'

/**
 * Dokumen PDF arsip. Tipe lokal eksplisit (tanpa `width`/`height`/`variants`)
 * karena PDF tidak punya dimensi; `GET /archives/:id` mengembalikan bentuk ini.
 */
export interface ArchiveDocument {
  id: string
  url: string
  key: string
  filename: string
  mimeType: string | null
  size: number | null
}

export interface Archive {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  type: ArchiveType
  status: ArchiveStatus
  publishedAt: string | null
  /** Daftar URL eksternal berurut. */
  externalLinks: string[]
  categories: ArchiveCategory[]
  authors: { id: string; fullName: string }[]
  creator: ArchiveCreator | null
  /** Hanya ada pada detail (`GET /archives/:id`), terurut dari `documentIds`. */
  documents?: ArchiveDocument[]
  createdAt: string
  updatedAt: string
}

export interface CreateArchiveInput {
  name: string
  description?: string
  /** URL string hasil `POST /images`; tanpa `imageIds`. */
  thumbnail?: string
  type?: ArchiveType
  status?: ArchiveStatus
  publishedAt?: string
  categoryIds?: string[]
  authorIds?: string[]
  /** Berurut; bila dikirim = replace seluruh array. */
  externalLinks?: string[]
  /** Berurut (`documents.map(d => d.id)`); bila dikirim = replace seluruh array. */
  documentIds?: string[]
}

// `thumbnail: null` menghapus thumbnail; `publishedAt: null` menghapus tanggal publish.
// Field di-omit bila tidak diubah.
export interface UpdateArchiveInput extends Partial<Omit<CreateArchiveInput, 'thumbnail' | 'publishedAt'>> {
  thumbnail?: string | null
  publishedAt?: string | null
}

export const ARCHIVE_TYPES = ['MEMBER', 'PUBLIC'] as const

export const ARCHIVE_STATUSES = ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] as const
