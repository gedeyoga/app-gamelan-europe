export type ArchiveSubmissionStatus = 'REQUEST' | 'APPROVED' | 'REJECTED'

export interface ArchiveSubmission {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  externalLinks: string[]
  /** Jumlah lampiran PDF (server-derived; tanpa hidrasi detail). */
  attachmentCount: number
  status: ArchiveSubmissionStatus
  adminNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  archiveId: string | null
  createdAt: string
  updatedAt: string
}

export interface ApproveArchiveSubmissionResult {
  submission: ArchiveSubmission
  archive: { id: string; status: 'DRAFT' }
}
