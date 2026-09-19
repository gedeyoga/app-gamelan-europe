import { Prisma } from '@prisma/client';

// View list: tanpa relasi country.
export const stateSelect = {
  id: true,
  name: true,
  countryCode: true,
  iso2: true,
  iso3166_2: true,
  type: true,
  level: true,
  native: true,
  latitude: true,
  longitude: true,
  timezone: true,
  wikiDataId: true,
  countryId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StateSelect;

export type StateEntity = Prisma.StateGetPayload<{ select: typeof stateSelect }>;

// View detail: menyertakan country pemilik state.
export const stateWithCountrySelect = {
  ...stateSelect,
  country: { select: { id: true, iso2: true, name: true } },
} satisfies Prisma.StateSelect;

export type StateWithCountryEntity = Prisma.StateGetPayload<{
  select: typeof stateWithCountrySelect;
}>;
