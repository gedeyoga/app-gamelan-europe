import { Prisma } from '@prisma/client';

export const eventTypeSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EventTypeSelect;

export type EventTypeEntity = Prisma.EventTypeGetPayload<{ select: typeof eventTypeSelect }>;
