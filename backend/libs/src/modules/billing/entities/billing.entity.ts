import { Prisma } from '@prisma/client';

export const billingSelect = {
  id: true,
  userId: true,
  networkId: true,
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
  user: { select: { id: true, fullName: true, email: true } },
  network: { select: { id: true, name: true } },
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
