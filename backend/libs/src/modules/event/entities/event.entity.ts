import { Prisma } from '@prisma/client';

// `eventSelect` query raw (join shape). JANGAN dikembalikan langsung ke API —
// map lewat `mapEvent()` agar `eventTypes`/`dates`/`location` flat.
export const eventSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  source: true,
  publishedAt: true,
  approvedAt: true,
  content: true,
  thumbnail: true,
  visibility: true,
  entry: true,
  createdBy: true,
  networkId: true,
  creator: {
    select: {
      id: true,
      fullName: true,
      networkId: true, // internal (row-level scoping); tidak keluar ke FE
      network: { select: { id: true, name: true } }, // name keluar ke FE
    },
  },
  dates: { select: { date: true, startTime: true, endTime: true }, orderBy: { date: 'asc' } },
  eventTypes: {
    select: {
      eventType: { select: { id: true, name: true } },
    },
  },
  authors: {
    select: {
      author: {
        select: {
          id: true,
          fullName: true,
          avatar: true,
          countryId: true,
          country: { select: { id: true, iso2: true, name: true } },
          stateId: true,
          state: { select: { id: true, name: true } },
        },
      },
    },
  },
  locations: {
    select: {
      name: true,
      address: true,
      lat: true,
      lng: true,
      countryId: true,
      stateId: true,
      cityId: true,
      country: { select: { id: true, name: true, iso2: true } },
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
    },
  },
  network: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EventSelect;

export type EventRow = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

export type EventTypeRef = { id: string; name: string };

export type EventAuthorRef = EventRow['authors'][number]['author'];

export type EventLocationEntity = {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  countryId: number | null;
  stateId: number | null;
  cityId: number | null;
  country: { id: number; name: string; iso2: string } | null;
  state: { id: number; name: string } | null;
  city: { id: number; name: string } | null;
};

export type EventDateEntity = {
  date: string; // ISO 8601 UTC
  startTime: string | null; // "HH:mm"
  endTime: string | null; // "HH:mm"
};

// Kontrak response API: relasi flat (`eventTypes`, `dates` ISO UTC, `location`).
export type EventEntity = Omit<EventRow, 'dates' | 'eventTypes' | 'locations' | 'authors'> & {
  dates: EventDateEntity[];
  eventTypes: EventTypeRef[];
  authors: EventAuthorRef[];
  location: EventLocationEntity | null;
};

// `creator.networkId` hanya dipakai internal (scope); tidak pernah keluar ke FE.
// `creator.network` ({ id, name } | null) keluar ke FE; null → FE fallback ke `fullName`.
export type EventCreatorRef = {
  id: string;
  fullName: string;
  network: { id: string; name: string } | null;
};

export type EventResponse = Omit<EventEntity, 'creator'> & {
  creator: EventCreatorRef | null;
};

export function mapEvent(row: EventRow): EventEntity {
  const { dates, eventTypes, locations, authors, ...rest } = row;
  const [location] = locations;
  return {
    ...rest,
    dates: dates.map((d) => ({
      date: d.date.toISOString(),
      startTime: d.startTime,
      endTime: d.endTime,
    })),
    eventTypes: eventTypes.map((link) => link.eventType),
    authors: authors.map((link) => link.author),
    location: location
      ? {
          name: location.name,
          address: location.address,
          lat: location.lat === null ? null : Number(location.lat),
          lng: location.lng === null ? null : Number(location.lng),
          countryId: location.countryId,
          stateId: location.stateId,
          cityId: location.cityId,
          country: location.country,
          state: location.state,
          city: location.city,
        }
      : null,
  };
}
