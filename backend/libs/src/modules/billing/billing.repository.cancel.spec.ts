import { BillingRepository, SubscribeInput } from './billing.repository';
import { PrismaService } from '@app/libs/core/database/prisma.service';

// Baris minimal yang cukup untuk `mapBilling` (total Decimal, lines array).
function billingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    userId: 'u1',
    subscriptionId: 's1',
    code: 'INV-20261008-AAAAAA',
    status: 'CANCELED',
    subscriptionType: 'MONTHLY',
    currency: 'IDR',
    total: 1 as unknown as object,
    discount: null,
    tax: null,
    paidAt: null,
    canceledAt: null,
    startDate: null,
    expiryDate: null,
    paymentProofUrl: null,
    paymentProofName: null,
    user: { id: 'u1', fullName: 'Andi', email: 'andi@example.com', avatar: null },
    subscription: { id: 's1', name: 'Monthly', slug: 'monthly' },
    lines: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BillingRepository.cancel', () => {
  it('mengirim expiryDate: null saat cancel (bukan hanya status)', async () => {
    const update = jest.fn().mockResolvedValue(billingRow());
    const prisma = {
      billing: { findUnique: jest.fn().mockResolvedValue({ id: 'b1' }), update },
    } as unknown as PrismaService;
    const repo = new BillingRepository(prisma);

    await repo.cancel('b1');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({ status: 'CANCELED', expiryDate: null }),
      }),
    );
  });
});

describe('BillingRepository.subscribe (auto-cancel billing PAID lama)', () => {
  it('mengirim expiryDate: null pada updateMany pembatalan otomatis', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      billing: { updateMany, create: jest.fn().mockResolvedValue(billingRow({ status: 'PAID' })) },
    };
    const prisma = {
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaService;
    const repo = new BillingRepository(prisma);

    const input: SubscribeInput = {
      userId: 'u1',
      subscriptionId: 's1',
      subscriptionType: 'MONTHLY',
      currency: 'IDR',
      total: 1,
      startDate: new Date('2026-10-08T00:00:00Z'),
      expiryDate: new Date('2026-11-07T00:00:00Z'),
      now: new Date('2026-10-08T00:00:00Z'),
    };

    await repo.subscribe(input);

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: 'PAID' },
      data: { status: 'CANCELED', canceledAt: input.now, expiryDate: null },
    });
  });
});
