import { Prisma } from '@prisma/client';

export const billingSelect = {
  id: true,
  userId: true,
  subscriptionId: true,
  code: true,
  status: true,
  subscriptionType: true,
  currency: true,
  total: true,
  discount: true,
  tax: true,
  paidAt: true,
  canceledAt: true,
  startDate: true,
  expiryDate: true,
  paymentProofUrl: true,
  paymentProofName: true,
  user: { select: { id: true, fullName: true, email: true, avatar: true } },
  subscription: { select: { id: true, name: true, slug: true } },
  lines: { select: { id: true, description: true, type: true, qty: true, amount: true, currency: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BillingSelect;

export type BillingPayload = Prisma.BillingGetPayload<{ select: typeof billingSelect }>;
export type BillingLinePayload = BillingPayload['lines'][number];

// Decimal → number (aman untuk JSON); tidak ada kolom sensitif.
export type BillingLineEntity = Omit<BillingLinePayload, 'amount'> & { amount: number };

export type BillingEntity = Omit<BillingPayload, 'total' | 'discount' | 'tax' | 'lines'> & {
  total: number;
  discount: number | null;
  tax: number | null;
  lines: BillingLineEntity[];
};

export function mapBilling(row: BillingPayload): BillingEntity {
  return {
    ...row,
    total: Number(row.total),
    discount: row.discount === null ? null : Number(row.discount),
    tax: row.tax === null ? null : Number(row.tax),
    lines: row.lines.map((line) => ({ ...line, amount: Number(line.amount) })),
  };
}

// Notifikasi lifecycle: hanya kolom yang dipakai email (id, owner, paket, tanggal akhir).
export const subscriptionLifecycleSelect = {
  id: true,
  userId: true,
  expiryDate: true,
  subscription: { select: { name: true } },
} satisfies Prisma.BillingSelect;

export type SubscriptionLifecyclePayload = Prisma.BillingGetPayload<{ select: typeof subscriptionLifecycleSelect }>;

export interface SubscriptionLifecycleRow {
  id: string;
  userId: string;
  name: string;
  // `null` hanya mungkin untuk billing CANCELED; query lifecycle memfilter PAID + expiryDate terisi.
  expiryDate: Date | null;
}

export function mapSubscriptionLifecycle(row: SubscriptionLifecyclePayload): SubscriptionLifecycleRow {
  return { id: row.id, userId: row.userId, name: row.subscription.name, expiryDate: row.expiryDate };
}

// Dua window job lifecycle (EXPIRING + EXPIRED) — dirakit BillingService, dikonsumsi NotificationService.
export interface SubscriptionLifecycleRows {
  expiring: SubscriptionLifecycleRow[];
  expired: SubscriptionLifecycleRow[];
}

export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'NONE';

// Satu baris member + billing TERBARU-nya (nested `take: 1`). `createdAt` user ikut demi sortBy
// `createdAt` (tidak keluar di response).
export const memberSelect = {
  id: true,
  fullName: true,
  email: true,
  avatar: true,
  createdAt: true,
  billings: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true,
      status: true,
      startDate: true,
      expiryDate: true,
      subscription: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.UserSelect;

export type MemberPayload = Prisma.UserGetPayload<{ select: typeof memberSelect }>;

// Kontrak list /billings/members — tanggal ISO, `status` dihitung (bukan kolom DB).
export interface MemberSubscription {
  userId: string;
  user: { id: string; fullName: string; email: string; avatar: string | null };
  billingId: string | null;
  startDate: string | null;
  expiryDate: string | null;
  subscription: { id: string; name: string; slug: string } | null;
  status: MemberStatus;
}

export function mapMemberSubscription(row: MemberPayload, now: Date = new Date()): MemberSubscription {
  const billing = row.billings[0] ?? null;
  const status: MemberStatus = !billing
    ? 'NONE'
    : billing.status === 'PAID' && billing.expiryDate !== null && billing.expiryDate.getTime() > now.getTime()
      ? 'ACTIVE'
      : 'INACTIVE';
  return {
    userId: row.id,
    user: { id: row.id, fullName: row.fullName, email: row.email, avatar: row.avatar },
    billingId: billing?.id ?? null,
    startDate: billing?.startDate ? billing.startDate.toISOString() : null,
    expiryDate: billing?.expiryDate ? billing.expiryDate.toISOString() : null,
    subscription: billing?.subscription ?? null,
    status,
  };
}
