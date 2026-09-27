import { Prisma } from '@prisma/client';
import type { DocumentResponse } from '@app/libs/modules/document/document.service';

// Query raw (join shape). JANGAN dikembalikan langsung ke API — map lewat
// `mapArchiveSubmission()` agar relasi `archive` ter-flatten ke `{ id, status }`.
export const archiveSubmissionSelect = {
  id: true,
  name: true,
  description: true,
  thumbnail: true,
  externalLinks: true,
  attachmentIds: true,
  status: true,
  adminNote: true,
  reviewedBy: true,
  reviewedAt: true,
  archiveId: true,
  createdAt: true,
  updatedAt: true,
  archive: { select: { id: true, status: true } },
} satisfies Prisma.ArchiveSubmissionSelect;

export type ArchiveSubmissionPayload = Prisma.ArchiveSubmissionGetPayload<{
  select: typeof archiveSubmissionSelect;
}>;

// Kontrak response API: relasi join flat ke `{ id, status }` (null bila belum ditautkan).
// `attachmentIds` (scalar) tetap di entity internal — dipakai saat approve & hydrate detail.
export type ArchiveSubmissionEntity = Omit<ArchiveSubmissionPayload, 'archive'> & {
  archive: { id: string; status: string } | null;
};

// Item LIST: buang `attachmentIds` mentah (tanpa lookup dokumen); ekspos `attachmentCount`.
export type ArchiveSubmissionListItem = Omit<ArchiveSubmissionEntity, 'attachmentIds'> & {
  attachmentCount: number;
};

// DETAIL: `attachmentIds` mentah diganti `attachments` hasil resolusi berurut (DocumentResponse).
export type ArchiveSubmissionResponse = Omit<ArchiveSubmissionListItem, 'attachmentCount'> & {
  attachments: DocumentResponse[];
};

export function mapArchiveSubmission(row: ArchiveSubmissionPayload): ArchiveSubmissionEntity {
  const { archive, ...rest } = row;
  return {
    ...rest,
    archive: archive ? { id: archive.id, status: archive.status } : null,
  };
}
