import { Prisma } from '@prisma/client';

// `deletedAt` sengaja tidak dipilih → tidak pernah keluar ke API.
export const subscriptionSelect = {
  id: true,
  name: true,
  slug: true,
  subscriptionType: true,
  status: true,
  currency: true,
  price: true,
  durationInDays: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionSelect;

export type SubscriptionPayload = Prisma.SubscriptionGetPayload<{ select: typeof subscriptionSelect }>;

// Decimal → number (aman untuk JSON); tidak ada kolom sensitif.
// `subscriberCount` = jumlah user UNIK dengan Billing status PAID (computed, bukan kolom DB).
export type SubscriptionEntity = Omit<SubscriptionPayload, 'price'> & { price: number; subscriberCount: number };

export function mapSubscription(row: SubscriptionPayload, subscriberCount = 0): SubscriptionEntity {
  return { ...row, price: Number(row.price), subscriberCount };
}
