import { Prisma } from '@prisma/client';

export const imageSelect = {
  id: true,
  entityType: true,
  entityId: true,
  createdBy: true,
  key: true,
  filename: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  variants: true,
  order: true,
  createdAt: true,
} satisfies Prisma.ImageSelect;

export type ImageEntity = Prisma.ImageGetPayload<{ select: typeof imageSelect }>;

// Elemen kolom Json `variants` (di-cast saat mapping).
export type ImageVariant = {
  name: 'large' | 'medium' | 'thumbnail';
  key: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
};
