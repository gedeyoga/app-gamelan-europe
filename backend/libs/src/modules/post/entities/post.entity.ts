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
  visibility: true,
  createdBy: true,
  creator: { select: { id: true, fullName: true, organizationId: true } },
  categories: {
    select: {
      category: { select: { id: true, name: true, type: true } },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PostSelect;

export type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

export type PostCategoryEntity = { id: string; name: string; type: CategoryType };

// Kontrak response API: `categories` flat (bukan `[{ category }]`).
export type PostEntity = Omit<PostRow, 'categories'> & {
  categories: PostCategoryEntity[];
};

// `creator.organizationId` hanya dipakai internal (scope); tidak pernah keluar ke FE.
export type CreatorRef = { id: string; fullName: string };

// Kontrak response ke FE: `galleryImageIds` (raw) diganti `gallery` hasil resolusi berurut.
export type PostResponse = Omit<PostEntity, 'galleryImageIds' | 'creator'> & {
  creator: CreatorRef | null;
  gallery: ImageResponse[];
};

export function mapPost(row: PostRow): PostEntity {
  return { ...row, categories: row.categories.map((link) => link.category) };
}
