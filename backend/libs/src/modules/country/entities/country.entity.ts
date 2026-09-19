import { Prisma } from '@prisma/client';

export const countrySelect = {
  id: true,
  name: true,
  iso2: true,
  iso3: true,
  numericCode: true,
  phoneCode: true,
  capital: true,
  currency: true,
  currencyName: true,
  currencySymbol: true,
  tld: true,
  native: true,
  population: true,
  gdp: true,
  regionName: true,
  subregion: true,
  nationality: true,
  timezones: true,
  translations: true,
  latitude: true,
  longitude: true,
  emoji: true,
  emojiU: true,
  wikiDataId: true,
  regionId: true,
  region: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CountrySelect;

export type CountryPayload = Prisma.CountryGetPayload<{ select: typeof countrySelect }>;

// BigInt tidak bisa di-JSON.stringify; konversi ke number untuk response API.
export type CountryEntity = Omit<CountryPayload, 'population' | 'gdp'> & {
  population: number | null;
  gdp: number | null;
};

export function toCountryEntity(country: CountryPayload): CountryEntity {
  return {
    ...country,
    population: country.population === null ? null : Number(country.population),
    gdp: country.gdp === null ? null : Number(country.gdp),
  };
}
