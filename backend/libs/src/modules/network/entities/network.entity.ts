import { Prisma } from '@prisma/client';

export const networkSelect = {
  id: true,
  name: true,
  state: true,
  country: true,
  address: true,
  content: true,
  website: true,
  contact: true,
  socialMedia: true,
  lat: true,
  lng: true,
  embedUrl: true,
  status: true,
  source: true,
  publishedAt: true,
  approvedAt: true,
  organisationType: true,
  ledBy: true,
  mapsUrl: true,
  activityType: true,
  countryId: true,
  stateId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NetworkSelect;

export type NetworkPayload = Prisma.NetworkGetPayload<{ select: typeof networkSelect }>;

// Decimal tidak bisa dipakai langsung FE; konversi `lat`/`lng` → number | null.
export type NetworkEntity = Omit<NetworkPayload, 'lat' | 'lng'> & {
  lat: number | null;
  lng: number | null;
};

export function mapNetwork(row: NetworkPayload): NetworkEntity {
  return {
    ...row,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
  };
}
