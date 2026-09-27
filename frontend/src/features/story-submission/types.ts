import type { UploadedImage } from '@/types/image'

export type StorySubmissionStatus = 'REQUEST' | 'APPROVED' | 'REJECTED'

export interface StorySubmissionCategory {
  id: string
  name: string
}

export interface StorySubmissionPost {
  id: string
  slug: string
  status: string
}

/** Bentuk item list `GET /story-submissions`. */
export interface StorySubmission {
  id: string
  name: string
  thumbnail: string | null
  categories: StorySubmissionCategory[]
  /** Jumlah gambar galeri (server-derived); `0` → sembunyikan. */
  galleryCount: number
  /** Jumlah flyer (server-derived); `0` → sembunyikan. */
  flyerCount: number
  status: StorySubmissionStatus
  adminNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  postId: string | null
  /** Post hasil approval, `null` sebelum disetujui. */
  post: StorySubmissionPost | null
  createdAt: string
  updatedAt: string
}

/** Bentuk detail `GET /story-submissions/:id` — menambah konten + relasi gambar. */
export interface StorySubmissionDetail extends StorySubmission {
  /** HTML dari API; sanitasi via `sanitizeHtml` sebelum dirender. */
  content: string
  categoryIds: string[]
  gallery: UploadedImage[]
  flyer: UploadedImage[]
}

export interface ApproveStorySubmissionResult {
  submission: StorySubmission
  story: { id: string; slug: string; status: 'DRAFT' }
}
