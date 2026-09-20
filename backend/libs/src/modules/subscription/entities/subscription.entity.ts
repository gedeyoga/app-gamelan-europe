import { Prisma } from '@prisma/client';

// `deletedAt` sengaja tidak dipilih → tidak pernah keluar ke API.
export const subscriptionSelect = {
  id: true,
  name: true,
  slug: true,
  subscriptionType: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionSelect;

export type SubscriptionPayload = Prisma.SubscriptionGetPayload<{ select: typeof subscriptionSelect }>;

// Tidak ada kolom Decimal di model ini → mapping passthrough.
export type SubscriptionEntity = SubscriptionPayload;

export function mapSubscription(row: SubscriptionPayload): SubscriptionEntity {
  return row;
}
