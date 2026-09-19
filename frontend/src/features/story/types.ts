export type ContentStatus = 'DRAFT' | 'REQUEST' | 'APPROVED' | 'PUBLISHED'

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

export type ImageVariantName = 'large' | 'medium' | 'thumbnail'

export interface ImageVariant {
  name: ImageVariantName
  url: string
  key: string
  width: number
  height: number
  size: number
  mimeType: string
}

export interface UploadedImage {
  id: string
  url: string
  key: string
  filename: string
  mimeType: string | null
  size: number
  width: number
  height: number
  variants: ImageVariant[]
}

export interface Story {
  id: string
  name: string
  slug: string
  status: ContentStatus
  publishedAt: string | null
  content?: string
  thumbnail: string | null
  categories: StoryCategory[]
  creator: Creator | null
  /** Galeri gambar berurut (kontrak `GET /posts/:id`). */
  gallery: UploadedImage[]
  createdAt: string
  updatedAt: string
}

export interface CreateStoryInput {
  name: string
  slug?: string
  content?: string
  thumbnail?: string | null
  status?: ContentStatus
  categoryIds?: string[]
  imageIds?: string[]
  /** Galeri gambar berurut (id `Image`); bila dikirim = replace seluruh galeri. */
  galleryImageIds?: string[]
  // Bila dikirim: backend menetapkan tanggal ini dan memaksa `status = PUBLISHED`.
  publishedAt?: string
}

// `thumbnail: null` menghapus thumbnail; field di-omit bila tidak diubah.
export type UpdateStoryInput = Partial<CreateStoryInput>

export const CONTENT_STATUSES = ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] as const
