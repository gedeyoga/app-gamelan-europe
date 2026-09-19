import { Prisma } from '@prisma/client';

export const categorySelect = {
  id: true,
  name: true,
  type: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

export type CategoryEntity = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;
