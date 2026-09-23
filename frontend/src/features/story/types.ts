export type ContentStatus = 'DRAFT' | 'REQUEST' | 'APPROVED' | 'PUBLISHED'

export type StoryFormAction = 'save' | 'draft' | 'request' | 'publish' | 'approve' | 'reject'

export type Visibility = 'PUBLIC' | 'PRIVATE'

export type CategoryType = 'STORY' | 'ARCHIVE'

export interface StoryCategory {
  id: string
  name: string
  type: CategoryType
}

export interface Creator {
  id: string
  fullName: string
}

export type { ImageVariant, ImageVariantName, UploadedImage } from '@/types/image'
import type { UploadedImage } from '@/types/image'

export interface Story {
  id: string
  name: string
  slug: string
  status: ContentStatus
  visibility: Visibility
  publishedAt: string | null
  content?: string
  thumbnail: string | null
  categories: StoryCategory[]
  creator: Creator | null
  /** Galeri gambar berurut (kontrak `GET /posts/:id`). */
  gallery: UploadedImage[]
  /** Flyer gambar berurut (kontrak `GET /posts/:id`). */
  flyer: UploadedImage[]
  createdAt: string
  updatedAt: string
}

export interface CreateStoryInput {
  name: string
  slug?: string
  content?: string
  thumbnail?: string | null
  status?: ContentStatus
  visibility?: Visibility
  categoryIds?: string[]
  imageIds?: string[]
  /** Galeri gambar berurut (id `Image`); bila dikirim = replace seluruh galeri. */
  galleryImageIds?: string[]
  /** Flyer gambar berurut (id `Image`); bila dikirim = replace seluruh flyer. */
  flyerImageIds?: string[]
  // Bila dikirim: backend menetapkan tanggal ini dan memaksa `status = PUBLISHED`.
  publishedAt?: string
}

// `thumbnail: null` menghapus thumbnail; field di-omit bila tidak diubah.
export type UpdateStoryInput = Partial<CreateStoryInput>

export const CONTENT_STATUSES = ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] as const

export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const
