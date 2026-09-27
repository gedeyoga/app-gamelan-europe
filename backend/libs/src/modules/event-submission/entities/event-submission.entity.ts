import { Prisma } from '@prisma/client';

// Query raw (join shape). JANGAN dikembalikan langsung ke API — map lewat `mapEventSubmission()`
// agar `country`/`state`/`eventType` ter-flatten.
export const eventSubmissionSelect = {
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  countryId: true,
  stateId: true,
  organiser: true,
  eventTypeId: true,
  shortDescription: true,
  thumbnail: true,
  status: true,
  adminNote: true,
  reviewedBy: true,
  reviewedAt: true,
  eventId: true,
  createdAt: true,
  updatedAt: true,
  country: { select: { id: true, iso2: true, name: true } },
  state: { select: { id: true, name: true } },
  eventType: { select: { id: true, name: true } },
} satisfies Prisma.EventSubmissionSelect;

export type EventSubmissionPayload = Prisma.EventSubmissionGetPayload<{
  select: typeof eventSubmissionSelect;
}>;

// Kontrak response API: relasi join flat ke `{ id, name }` (null bila kosong).
export type EventSubmissionEntity = Omit<EventSubmissionPayload, 'country' | 'state' | 'eventType'> & {
  country: { id: number; iso2: string; name: string } | null;
  state: { id: number; name: string } | null;
  eventType: { id: string; name: string } | null;
};

export function mapEventSubmission(row: EventSubmissionPayload): EventSubmissionEntity {
  const { country, state, eventType, ...rest } = row;
  return {
    ...rest,
    country: country ? { id: country.id, iso2: country.iso2, name: country.name } : null,
    state: state ? { id: state.id, name: state.name } : null,
    eventType: eventType ? { id: eventType.id, name: eventType.name } : null,
  };
}
