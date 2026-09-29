import { Prisma } from '@prisma/client';

// Query raw (join shape). JANGAN dikembalikan langsung ke API — map lewat `mapEventSubmission()`
// agar `country`/`state`/`eventType`/`author` ter-flatten.
export const eventSubmissionSelect = {
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  countryId: true,
  stateId: true,
  organiser: true,
  authorFullName: true,
  authorEmail: true,
  authorCountryId: true,
  authorStateId: true,
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
  authorCountry: { select: { id: true, iso2: true, name: true } },
  authorState: { select: { id: true, name: true } },
} satisfies Prisma.EventSubmissionSelect;

export type EventSubmissionPayload = Prisma.EventSubmissionGetPayload<{
  select: typeof eventSubmissionSelect;
}>;

// Section `author` (data pengirim). Kolom flat `author*` TIDAK pernah bocor ke API.
export type EventSubmissionAuthorEntity = {
  fullName: string;
  email: string;
  countryId: number;
  stateId: number | null;
  country: { id: number; iso2: string; name: string } | null;
  state: { id: number; name: string } | null;
};

// Kontrak response API: relasi join flat ke `{ id, name }` (null bila kosong).
export type EventSubmissionEntity = Omit<
  EventSubmissionPayload,
  | 'country'
  | 'state'
  | 'eventType'
  | 'authorFullName'
  | 'authorEmail'
  | 'authorCountryId'
  | 'authorStateId'
  | 'authorCountry'
  | 'authorState'
> & {
  country: { id: number; iso2: string; name: string } | null;
  state: { id: number; name: string } | null;
  eventType: { id: string; name: string } | null;
  author: EventSubmissionAuthorEntity;
};

export function mapEventSubmission(row: EventSubmissionPayload): EventSubmissionEntity {
  const { country, state, eventType, authorFullName, authorEmail, authorCountryId, authorStateId, authorCountry, authorState, ...rest } = row;
  return {
    ...rest,
    country: country ? { id: country.id, iso2: country.iso2, name: country.name } : null,
    state: state ? { id: state.id, name: state.name } : null,
    eventType: eventType ? { id: eventType.id, name: eventType.name } : null,
    author: {
      fullName: authorFullName,
      email: authorEmail,
      countryId: authorCountryId,
      stateId: authorStateId,
      country: authorCountry ? { id: authorCountry.id, iso2: authorCountry.iso2, name: authorCountry.name } : null,
      state: authorState ? { id: authorState.id, name: authorState.name } : null,
    },
  };
}
