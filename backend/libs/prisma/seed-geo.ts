import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ponytail: seeder ini butuh jaringan ke raw.githubusercontent.com. Untuk offline/CI,
// vendorkan `regions.json` + `countries.json` + `states.json` ke repo lalu baca dari disk
// (ganti fetchJson → fs.readFile). Sumber: https://github.com/dr5hn/countries-states-cities-database
const REGIONS_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/regions.json';
const COUNTRIES_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries.json';
const STATES_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/states.json';

type RawRegion = { name?: unknown; translations?: unknown; wikiDataId?: unknown };

type RawCountry = {
  name?: unknown;
  iso2?: unknown;
  iso3?: unknown;
  numeric_code?: unknown;
  phonecode?: unknown;
  phone_code?: unknown;
  capital?: unknown;
  currency?: unknown;
  currency_name?: unknown;
  currency_symbol?: unknown;
  tld?: unknown;
  native?: unknown;
  population?: unknown;
  gdp?: unknown;
  region?: unknown;
  subregion?: unknown;
  nationality?: unknown;
  timezones?: unknown;
  translations?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  emoji?: unknown;
  emojiU?: unknown;
  wikiDataId?: unknown;
};

type RawState = {
  id?: unknown;
  name?: unknown;
  country_code?: unknown;
  fips_code?: unknown;
  iso2?: unknown;
  iso3166_2?: unknown;
  type?: unknown;
  level?: unknown;
  parent_id?: unknown;
  native?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
  translations?: unknown;
  wikiDataId?: unknown;
};

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function toBigIntValue(value: unknown): bigint | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'bigint') return value;
  const num = Number(value);
  return Number.isFinite(num) ? BigInt(Math.trunc(num)) : null;
}

function toDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toIntValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
}

function toJsonInput(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Gagal fetch ${url}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function main(): Promise<void> {
  const [rawRegions, rawCountries, rawStates] = await Promise.all([
    fetchJson<RawRegion[]>(REGIONS_URL),
    fetchJson<RawCountry[]>(COUNTRIES_URL),
    fetchJson<RawState[]>(STATES_URL),
  ]);

  if (!Array.isArray(rawRegions) || !Array.isArray(rawCountries) || !Array.isArray(rawStates)) {
    throw new Error('Format JSON regions/countries/states tidak sesuai (bukan array).');
  }

  const countryIdByIso2 = new Map<string, number>();

  await prisma.$transaction(
    async (tx) => {
      const regionIdByName = new Map<string, number>();

      for (const raw of rawRegions) {
        const name = str(raw.name);
        if (!name) continue;
        const saved = await tx.region.upsert({
          where: { name },
          update: { translations: toJsonInput(raw.translations), wikiDataId: str(raw.wikiDataId) },
          create: { name, translations: toJsonInput(raw.translations), wikiDataId: str(raw.wikiDataId) },
        });
        regionIdByName.set(saved.name, saved.id);
      }
      console.log(`region: ${regionIdByName.size} upserted`);

      let count = 0;
      for (const raw of rawCountries) {
        const iso2 = str(raw.iso2);
        const name = str(raw.name);
        if (!iso2 || !name) continue;

        const regionName = str(raw.region);
        const data = {
          name,
          iso3: str(raw.iso3),
          numericCode: str(raw.numeric_code),
          phoneCode: str(raw.phonecode ?? raw.phone_code),
          capital: str(raw.capital),
          currency: str(raw.currency),
          currencyName: str(raw.currency_name),
          currencySymbol: str(raw.currency_symbol),
          tld: str(raw.tld),
          native: str(raw.native),
          population: toBigIntValue(raw.population),
          gdp: toBigIntValue(raw.gdp),
          regionName,
          subregion: str(raw.subregion),
          nationality: str(raw.nationality),
          timezones: toJsonInput(raw.timezones),
          translations: toJsonInput(raw.translations),
          latitude: toDecimal(raw.latitude),
          longitude: toDecimal(raw.longitude),
          emoji: str(raw.emoji),
          emojiU: str(raw.emojiU),
          wikiDataId: str(raw.wikiDataId),
          regionId: regionName ? regionIdByName.get(regionName) ?? null : null,
        };

        const saved = await tx.country.upsert({
          where: { iso2 },
          update: data,
          create: { iso2, ...data },
          select: { id: true, iso2: true },
        });
        countryIdByIso2.set(saved.iso2, saved.id);
        count += 1;
      }
      console.log(`country: ${count} upserted`);
    },
    { timeout: 120000 },
  );

  // --- States (replace penuh, lihat catatan ponytail di bawah) ---
  const stateRows = new Map<number, Prisma.StateCreateManyInput>();
  let skippedStates = 0;

  for (const raw of rawStates) {
    const id = toIntValue(raw.id);
    const name = str(raw.name);
    const countryCode = str(raw.country_code);
    if (id === null || !name || !countryCode) {
      skippedStates += 1;
      continue;
    }
    const countryId = countryIdByIso2.get(countryCode.toUpperCase());
    if (!countryId) {
      skippedStates += 1;
      continue;
    }
    // Dedup by id — createMany gagal seluruhnya bila ada PK duplikat.
    stateRows.set(id, {
      id,
      name,
      countryCode: countryCode.toUpperCase(),
      countryId,
      fipsCode: str(raw.fips_code),
      iso2: str(raw.iso2),
      iso3166_2: str(raw.iso3166_2),
      type: str(raw.type),
      level: toIntValue(raw.level),
      parentId: toIntValue(raw.parent_id),
      native: str(raw.native),
      latitude: toDecimal(raw.latitude),
      longitude: toDecimal(raw.longitude),
      timezone: str(raw.timezone),
      translations: toJsonInput(raw.translations),
      wikiDataId: str(raw.wikiDataId),
    });
  }

  await prisma.$transaction(
    async (tx) => {
      // ponytail: states = reference data murni (tanpa child, tanpa alur bisnis). Replace penuh
      // deleteMany + createMany jauh lebih murah dari ~5k upsert; naikkan ke upsert bila butuh
      // partial update / preserve createdAt.
      await tx.state.deleteMany();
      await tx.state.createMany({ data: [...stateRows.values()] });
    },
    { timeout: 120000 },
  );
  console.log(`state: ${stateRows.size} seeded, ${skippedStates} skipped (country absent/invalid)`);

  console.log('Seed geo selesai (idempoten, additive).');
}

main()
  .catch((e: unknown) => {
    console.error('Seed geo gagal.');
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
