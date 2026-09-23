import { Prisma } from '@prisma/client';

// `documentSelect` query raw (join/internal shape). `entityType`/`entityId` dipakai
// untuk validasi binding; JANGAN dikembalikan langsung ke API — map via
// `DocumentService.toDocumentResponse` yang membuang field internal.
export const documentSelect = {
  id: true,
  entityType: true,
  entityId: true,
  key: true,
  filename: true,
  mimeType: true,
  size: true,
  createdAt: true,
} satisfies Prisma.DocumentSelect;

export type DocumentEntity = Prisma.DocumentGetPayload<{ select: typeof documentSelect }>;
