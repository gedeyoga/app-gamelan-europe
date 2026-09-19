import { Prisma } from '@prisma/client';

export const regionSelect = {
  id: true,
  name: true,
  wikiDataId: true,
  _count: { select: { countries: true } },
} satisfies Prisma.RegionSelect;

export type RegionEntity = Prisma.RegionGetPayload<{ select: typeof regionSelect }>;
