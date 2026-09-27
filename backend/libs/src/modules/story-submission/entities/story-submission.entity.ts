import { Prisma } from '@prisma/client';
import type { ImageResponse } from '@app/libs/modules/image/image.service';

// Query raw (join shape). JANGAN dikembalikan langsung ke API — map lewat
// `mapStorySubmission()` agar relasi `post` ter-flatten ke `{ id, slug, status }`.
export const storySubmissionSelect = {
  id: true,
  name: true,
  content: true,
  categoryIds: true,
  galleryImageIds: true,
  flyerImageIds: true,
  thumbnail: true,
  status: true,
  adminNote: true,
  reviewedBy: true,
  reviewedAt: true,
  postId: true,
  createdAt: true,
  updatedAt: true,
  post: { select: { id: true, slug: true, status: true } },
} satisfies Prisma.StorySubmissionSelect;

export type StorySubmissionPayload = Prisma.StorySubmissionGetPayload<{
  select: typeof storySubmissionSelect;
}>;

// Kontrak response API: relasi join flat ke `{ id, slug, status }` (null bila belum ditautkan).
// `content`/`categoryIds`/`galleryImageIds`/`flyerImageIds` (scalar) tetap di entity internal —
// dipakai saat approve & hydrate detail.
export type StorySubmissionEntity = Omit<StorySubmissionPayload, 'post'> & {
  post: { id: string; slug: string; status: string } | null;
};

export type SubmissionCategoryRef = { id: string; name: string };

// Item LIST: buang id/HTML mentah (tanpa lookup), ekspos nama kategori + jumlah gambar.
export type StorySubmissionListItem = Omit<
  StorySubmissionEntity,
  'content' | 'categoryIds' | 'galleryImageIds' | 'flyerImageIds'
> & {
  categories: SubmissionCategoryRef[];
  galleryCount: number;
  flyerCount: number;
};

// DETAIL: item list + `content` + `categoryIds` mentah + galeri/flyer ter-resolve berurut.
export type StorySubmissionDetail = StorySubmissionListItem & {
  content: string;
  categoryIds: string[];
  gallery: ImageResponse[];
  flyer: ImageResponse[];
};

export function mapStorySubmission(row: StorySubmissionPayload): StorySubmissionEntity {
  const { post, ...rest } = row;
  return {
    ...rest,
    post: post ? { id: post.id, slug: post.slug, status: post.status } : null,
  };
}
