import { Prisma } from '@prisma/client';

export const organizationSelect = {
  id: true,
  name: true,
  state: true,
  country: true,
  address: true,
  lat: true,
  lng: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

export type OrganizationPayload = Prisma.OrganizationGetPayload<{ select: typeof organizationSelect }>;

// Decimal tidak bisa dipakai langsung FE; konversi `lat`/`lng` → number | null.
export type OrganizationEntity = Omit<OrganizationPayload, 'lat' | 'lng'> & {
  lat: number | null;
  lng: number | null;
};

export function mapOrganization(row: OrganizationPayload): OrganizationEntity {
  return {
    ...row,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
  };
}
