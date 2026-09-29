import { CategoryType, Prisma } from '@prisma/client';
import type { ImageResponse } from '@app/libs/modules/image/image.service';

// `postSelect` query raw (join shape). JANGAN dikembalikan langsung ke API —
// map lewat `mapPost()` agar `categories` flat `[{ id, name, type }]`.
export const postSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  publishedAt: true,
  approvedAt: true,
  content: true,
  thumbnail: true,
  galleryImageIds: true,
  flyerImageIds: true,
  visibility: true,
  createdBy: true,
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
} satisfies Prisma.PostSelect;

export type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

export type PostCategoryEntity = { id: string; name: string; type: CategoryType };

export type PostAuthorEntity = PostRow['authors'][number]['author'];

// Kontrak response API: `categories` flat (bukan `[{ category }]`).
export type PostEntity = Omit<PostRow, 'categories' | 'authors'> & {
  categories: PostCategoryEntity[];
  authors: PostAuthorEntity[];
};

// `creator.networkId` hanya dipakai internal (scope); tidak pernah keluar ke FE.
export type CreatorRef = { id: string; fullName: string };

// Kontrak response ke FE: `galleryImageIds`/`flyerImageIds` (raw) diganti `gallery`/`flyer` hasil resolusi berurut.
export type PostResponse = Omit<PostEntity, 'galleryImageIds' | 'flyerImageIds' | 'creator'> & {
  creator: CreatorRef | null;
  gallery: ImageResponse[];
  flyer: ImageResponse[];
};

export function mapPost(row: PostRow): PostEntity {
  return { ...row, categories: row.categories.map((link) => link.category), authors: row.authors.map((link) => link.author) };
}
