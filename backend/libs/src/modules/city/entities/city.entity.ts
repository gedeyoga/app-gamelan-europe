import { Prisma } from '@prisma/client';

// View list: tanpa relasi.
export const citySelect = {
  id: true,
  name: true,
  countryId: true,
  stateId: true,
  latitude: true,
  longitude: true,
  wikiDataId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CitySelect;

export type CityEntity = Prisma.CityGetPayload<{ select: typeof citySelect }>;

// View detail: menyertakan state (bila ada) & country pemilik city.
export const cityWithRelationsSelect = {
  ...citySelect,
  state: { select: { id: true, name: true } },
  country: { select: { id: true, iso2: true, name: true } },
} satisfies Prisma.CitySelect;

export type CityWithRelationsEntity = Prisma.CityGetPayload<{
  select: typeof cityWithRelationsSelect;
}>;
