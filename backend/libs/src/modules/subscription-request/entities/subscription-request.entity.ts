import { Prisma } from '@prisma/client';

// Satu view payload untuk seluruh konsumen modul (list, detail, approve/reject).
export const subscriptionRequestSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  website: true,
  address: true,
  country: true,
  organisation: true,
  reason: true,
  requestType: true,
  status: true,
  reviewedAt: true,
  reviewNote: true,
  billingId: true,
  subscription: {
    select: {
      id: true,
      name: true,
      slug: true,
      subscriptionType: true,
      currency: true,
      price: true,
      durationInDays: true,
    },
  },
  user: { select: { id: true, fullName: true, email: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionRequestSelect;

export type SubscriptionRequestPayload = Prisma.SubscriptionRequestGetPayload<{
  select: typeof subscriptionRequestSelect;
}>;

// Decimal → number (aman untuk JSON); tidak ada kolom sensitif.
export type SubscriptionRequestEntity = Omit<SubscriptionRequestPayload, 'subscription'> & {
  subscription: Omit<SubscriptionRequestPayload['subscription'], 'price'> & { price: number };
};

export function mapSubscriptionRequest(row: SubscriptionRequestPayload): SubscriptionRequestEntity {
  return { ...row, subscription: { ...row.subscription, price: Number(row.subscription.price) } };
}
