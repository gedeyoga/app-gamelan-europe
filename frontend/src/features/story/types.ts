export type ContentStatus = 'DRAFT' | 'REQUEST' | 'APPROVED' | 'PUBLISHED'

export type StoryFormAction = 'save' | 'draft' | 'request' | 'publish' | 'approve' | 'reject'

export type Visibility = 'PUBLIC' | 'PRIVATE'

/** Asal konten: pengajuan publik (situs EGS) vs pengajuan member internal. */
export type ContentSource = 'PUBLIC' | 'REGISTERED'

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

/** Satu blok media flyer bertipe (mis. Flyer, Poster, Banner) — heading + gambar berurut. */
export interface FlyerGroup {
  type: string
  images: UploadedImage[]
}

/** Payload grup flyer: `type` teks bebas (trim, 1–40), `imageIds` id `Image` berurut. */
export interface FlyerItemInput {
  type: string
  imageIds: string[]
}

export interface Story {
  id: string
  name: string
  slug: string
  status: ContentStatus
  visibility: Visibility
  /** Asal konten (`PUBLIC` = pengajuan publik, `REGISTERED` = member internal). */
  source: ContentSource
  publishedAt: string | null
  content?: string
  thumbnail: string | null
  categories: StoryCategory[]
  authors: { id: string; fullName: string }[]
  creator: Creator | null
  /** Galeri gambar berurut (kontrak `GET /posts/:id`). */
  gallery: UploadedImage[]
  /** Flyer bertipe berurut (kontrak `GET /posts/:id`). */
  flyer: FlyerGroup[]
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
  authorIds?: string[]
  imageIds?: string[]
  /** Galeri gambar berurut (id `Image`); bila dikirim = replace seluruh galeri. */
  galleryImageIds?: string[]
  /** Grup flyer berurut; bila dikirim = replace seluruh grup flyer. */
  flyerItems?: FlyerItemInput[]
  // Bila dikirim: backend menetapkan tanggal ini dan memaksa `status = PUBLISHED`.
  publishedAt?: string
  /** Kirim email notifikasi ke penerima (default backend `true`). */
  notify?: boolean
}

// `thumbnail: null` menghapus thumbnail; field di-omit bila tidak diubah.
export type UpdateStoryInput = Partial<CreateStoryInput>

export const CONTENT_STATUSES = ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] as const

export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const
