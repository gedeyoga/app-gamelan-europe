import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ponytail: seeder ini butuh jaringan ke raw.githubusercontent.com. Untuk offline/CI,
// vendorkan `regions.json` + `countries.json` + `states.json` ke repo lalu baca dari disk
// (ganti fetchJson → fs.readFile). Sumber: https://github.com/dr5hn/countries-states-cities-database
// Catatan: upstream telah menghapus `json/cities.json`; city kini hanya tersedia nested di
// `json/countries+states+cities.json` (~47 MB). Traversal: country → states → cities.
const REGIONS_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/regions.json';
const COUNTRIES_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries.json';
const STATES_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/states.json';
const COUNTRIES_STATES_CITIES_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries+states+cities.json';

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

// City nested di dalam state (combined JSON). Field: id, name, latitude, longitude.
type RawCity = {
  id?: unknown;
  name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  wikiDataId?: unknown;
  wiki_data_id?: unknown;
};

type RawCountryWithCities = {
  iso2?: unknown;
  states?: Array<{ id?: unknown; cities?: RawCity[] }>;
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
  const [rawRegions, rawCountries, rawStates, rawCountriesWithCities] = await Promise.all([
    fetchJson<RawRegion[]>(REGIONS_URL),
    fetchJson<RawCountry[]>(COUNTRIES_URL),
    fetchJson<RawState[]>(STATES_URL),
    fetchJson<RawCountryWithCities[]>(COUNTRIES_STATES_CITIES_URL),
  ]);

  if (
    !Array.isArray(rawRegions) ||
    !Array.isArray(rawCountries) ||
    !Array.isArray(rawStates) ||
    !Array.isArray(rawCountriesWithCities)
  ) {
    throw new Error('Format JSON regions/countries/states/cities tidak sesuai (bukan array).');
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

  // Guard: format upstream berubah → stateRows kosong. Tanpa ini `notIn([])` menghapus SEMUA state.
  const CHUNK = 5000;
  if (stateRows.size > 0) {
    const stateList = [...stateRows.values()];
    // ponytail: state bukan reference murni — city inline user mereferensikannya, dan
    // FK cities.state_id ON DELETE SET NULL akan mencabut state dari city user bila state
    // dihapus. `id >= 0` melindungi state inline-create user (id negatif) dari prune;
    // hanya state dataset usang (id positif di luar dataset) yang dibersihkan.
    // createMany(skipDuplicates) mempertahankan baris lama (FK aman) + menyisipkan id baru.
    // Batas: skipDuplicates TIDAK me-refresh nilai kolom state yang sudah ada; upgrade ke
    // raw SQL `INSERT ... ON CONFLICT (id) DO UPDATE` bila butuh refresh penuh.
    await prisma.$transaction(
      async (tx) => {
        await tx.state.deleteMany({ where: { id: { notIn: [...stateRows.keys()], gte: 0 } } });
        for (let i = 0; i < stateList.length; i += CHUNK) {
          await tx.state.createMany({ data: stateList.slice(i, i + CHUNK), skipDuplicates: true });
        }
      },
      { timeout: 60000 },
    );
  }
  console.log(`state: ${stateRows.size} seeded, ${skippedStates} skipped (country absent/invalid)`);

  // --- Cities (replace per-id dataset; traversed dari nested states di combined JSON) ---
  const seededStateIds = new Set(stateRows.keys());
  const cityRows = new Map<number, Prisma.CityCreateManyInput>();
  let skippedCities = 0;

  for (const rawCountry of rawCountriesWithCities) {
    const iso2 = str(rawCountry.iso2);
    const countryId = iso2 ? countryIdByIso2.get(iso2.toUpperCase()) : undefined;
    const states = Array.isArray(rawCountry.states) ? rawCountry.states : [];
    for (const rawState of states) {
      // state_id nested = State.id (nullable). Bila state di-skip seeder → null agar FK aman.
      const rawStateId = toIntValue(rawState.id);
      const stateId = rawStateId !== null && rawStateId > 0 && seededStateIds.has(rawStateId) ? rawStateId : null;
      const cities = Array.isArray(rawState.cities) ? rawState.cities : [];
      for (const raw of cities) {
        const id = toIntValue(raw.id);
        const name = str(raw.name);
        if (id === null || !name || !countryId) {
          skippedCities += 1;
          continue;
        }
        // Dedup by id — createMany gagal seluruhnya bila ada PK duplikat.
        cityRows.set(id, {
          id,
          name,
          countryId,
          stateId,
          latitude: toDecimal(raw.latitude),
          longitude: toDecimal(raw.longitude),
          wikiDataId: str(raw.wikiDataId ?? raw.wiki_data_id),
        });
      }
    }
  }

  const cities = [...cityRows.values()];
  const datasetCityIds = [...cityRows.keys()];
  // Delete hanya id dataset (bukan SELURUH tabel): city hasil inline-create user (id di luar
  // dataset) tidak boleh hilang — FK event_locations.city_id ON DELETE SET NULL akan mencabut
  // kota dari event. Chunked: Postgres menolak `IN` dengan >65535 bind parameter.
  const DELETE_CHUNK = 10000;
  await prisma.$transaction(
    async (tx) => {
      // ponytail: cities = reference data (batch). Replace per-id, bukan truncate, agar city
      // inline user aman. Naikkan ke upsert bila butuh partial update / preserve createdAt.
      for (let i = 0; i < datasetCityIds.length; i += DELETE_CHUNK) {
        await tx.city.deleteMany({ where: { id: { in: datasetCityIds.slice(i, i + DELETE_CHUNK) } } });
      }
      for (let i = 0; i < cities.length; i += CHUNK) {
        await tx.city.createMany({ data: cities.slice(i, i + CHUNK) });
      }
      // createMany menulis id eksplisit → sequence TIDAK ter-advance (fresh deploy: migrasi
      // setval=1 → inline create berikutnya tabrakan PK). Advance ke MAX(id) di sini.
      await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('cities','id'), (SELECT COALESCE(MAX(id),0) FROM cities))`;
    },
    { timeout: 150000 },
  );
  console.log(`city: ${cityRows.size} seeded, ${skippedCities} skipped (country absent/invalid)`);

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
