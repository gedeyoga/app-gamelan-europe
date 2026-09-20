import { Prisma } from '@prisma/client';

// `eventSelect` query raw (join shape). JANGAN dikembalikan langsung ke API —
// map lewat `mapEvent()` agar `eventTypes`/`dates`/`location` flat.
export const eventSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  publishedAt: true,
  approvedAt: true,
  content: true,
  thumbnail: true,
  visibility: true,
  createdBy: true,
  creator: {
    select: {
      id: true,
      fullName: true,
      organizationId: true, // internal (row-level scoping); tidak keluar ke FE
      organization: { select: { id: true, name: true } }, // name keluar ke FE
    },
  },
  dates: { select: { date: true, startTime: true, endTime: true }, orderBy: { date: 'asc' } },
  eventTypes: {
    select: {
      eventType: { select: { id: true, name: true } },
    },
  },
  locations: { select: { name: true, address: true, lat: true, lng: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EventSelect;

export type EventRow = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

export type EventTypeRef = { id: string; name: string };

export type EventLocationEntity = {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type EventDateEntity = {
  date: string; // ISO 8601 UTC
  startTime: string | null; // "HH:mm"
  endTime: string | null; // "HH:mm"
};

// Kontrak response API: relasi flat (`eventTypes`, `dates` ISO UTC, `location`).
export type EventEntity = Omit<EventRow, 'dates' | 'eventTypes' | 'locations'> & {
  dates: EventDateEntity[];
  eventTypes: EventTypeRef[];
  location: EventLocationEntity | null;
};

// `creator.organizationId` hanya dipakai internal (scope); tidak pernah keluar ke FE.
// `creator.organization` ({ id, name } | null) keluar ke FE; null → FE fallback ke `fullName`.
export type EventCreatorRef = {
  id: string;
  fullName: string;
  organization: { id: string; name: string } | null;
};

export type EventResponse = Omit<EventEntity, 'creator'> & {
  creator: EventCreatorRef | null;
};

export function mapEvent(row: EventRow): EventEntity {
  const { dates, eventTypes, locations, ...rest } = row;
  const [location] = locations;
  return {
    ...rest,
    dates: dates.map((d) => ({
      date: d.date.toISOString(),
      startTime: d.startTime,
      endTime: d.endTime,
    })),
    eventTypes: eventTypes.map((link) => link.eventType),
    location: location
      ? {
          name: location.name,
          address: location.address,
          lat: location.lat === null ? null : Number(location.lat),
          lng: location.lng === null ? null : Number(location.lng),
        }
      : null,
  };
}
