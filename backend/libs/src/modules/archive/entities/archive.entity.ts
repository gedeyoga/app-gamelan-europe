import { ArchiveType, CategoryType, Prisma } from '@prisma/client';
import type { DocumentResponse } from '@app/libs/modules/document/document.service';

// `archiveSelect` query raw (join shape). JANGAN dikembalikan langsung ke API —
// map lewat `mapArchive()` agar `categories` flat `[{ id, name, type }]`.
export const archiveSelect = {
  id: true,
  name: true,
  description: true,
  thumbnail: true,
  type: true,
  status: true,
  publishedAt: true,
  approvedAt: true,
  externalLinks: true,
  documentIds: true,
  creator: { select: { id: true, fullName: true, networkId: true } },
  categories: {
    select: {
      category: { select: { id: true, name: true, type: true } },
    },
  },
  authors: {
    select: {
      author: {
        select: {
          id: true,
          fullName: true,
          avatar: true,
          countryId: true,
          country: { select: { id: true, iso2: true, name: true } },
          stateId: true,
          state: { select: { id: true, name: true } },
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArchiveSelect;

export type ArchiveRow = Prisma.ArchiveGetPayload<{ select: typeof archiveSelect }>;

export type ArchiveCategoryEntity = { id: string; name: string; type: CategoryType };

export type ArchiveAuthorEntity = ArchiveRow['authors'][number]['author'];

// Kontrak response API: `categories` flat (bukan `[{ category }]`).
// `documentIds` mentah tetap ada di entity internal (dipakai hydrate).
// `creator.networkId` hanya dipakai internal (row-level scoping) — TIDAK keluar ke FE.
export type ArchiveEntity = Omit<ArchiveRow, 'categories' | 'authors'> & {
  categories: ArchiveCategoryEntity[];
  authors: ArchiveAuthorEntity[];
};

// `creator.networkId` dibuang di response; FE hanya menerima `{ id, fullName }`.
export type ArchiveCreatorRef = { id: string; fullName: string };

// Item LIST = `ArchiveEntity` TANPA `documentIds` dan tanpa `creator.networkId`.
// `externalLinks` nullable: di-null-kan untuk member-only tanpa akses (lihat `redactMemberOnly`).
export type ArchiveListItem = Omit<ArchiveEntity, 'documentIds' | 'creator' | 'externalLinks'> & {
  creator: ArchiveCreatorRef | null;
  externalLinks: string[] | null;
};

// Kontrak DETAIL (`GET /archives/:id`): `documentIds` mentah diganti `documents` hasil resolusi berurut.
// `documents` nullable: di-null-kan untuk member-only tanpa akses (lihat `redactMemberOnly`).
export type ArchiveResponse = ArchiveListItem & {
  documents: DocumentResponse[] | null;
};

export function mapArchive(row: ArchiveRow): ArchiveEntity {
  return { ...row, categories: row.categories.map((link) => link.category), authors: row.authors.map((link) => link.author) };
}

// Redaksi member-only (pure, diekspor agar mudah di-unit-test).
// `type=MEMBER` + pemanggil tanpa akses member (`canViewPrivate=false`) →
// `externalLinks` (list & detail) dan `documents` (detail, bila ada) di-null-kan.
// `PUBLIC` maupun pemanggil berhak tidak diubah. `description` tetap terlihat.
export function redactMemberOnly<T extends { type: ArchiveType; externalLinks: string[] | null }>(
  archive: T,
  canViewPrivate: boolean,
): T {
  if (archive.type !== ArchiveType.MEMBER || canViewPrivate) return archive;
  return {
    ...archive,
    externalLinks: null,
    ...('documents' in archive ? { documents: null } : {}),
  } as T;
}
