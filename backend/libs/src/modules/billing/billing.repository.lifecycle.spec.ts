import { PrismaService } from '@app/libs/core/database/prisma.service';
import { BillingRepository } from './billing.repository';

const NOW = new Date('2026-10-19T12:00:00.000Z');
const UNTIL = new Date('2026-10-26T12:00:00.000Z');
const EXPIRY = new Date('2026-10-22T00:00:00.000Z');

function makeRepo(rows: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { billing: { findMany } } as unknown as PrismaService;
  return { repo: new BillingRepository(prisma), findMany };
}

describe('BillingRepository.findExpiringSubscriptions', () => {
  it('PAID dengan expiryDate di (now, until] + select minimal', async () => {
    const { repo, findMany } = makeRepo([{ id: 'b1', userId: 'u1', expiryDate: EXPIRY, subscription: { name: 'Gold' } }]);

    await expect(repo.findExpiringSubscriptions(NOW, UNTIL)).resolves.toEqual([
      { id: 'b1', userId: 'u1', name: 'Gold', expiryDate: EXPIRY },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'PAID', expiryDate: { gt: NOW, lte: UNTIL } },
      select: {
        id: true,
        userId: true,
        expiryDate: true,
        subscription: { select: { name: true } },
      },
    });
  });
});

describe('BillingRepository.findExpiredSubscriptions', () => {
  it('PAID, expiryDate <= now, belum dibatalkan', async () => {
    const { repo, findMany } = makeRepo([
      { id: 'b2', userId: 'u2', expiryDate: EXPIRY, subscription: { name: 'Silver' } },
    ]);

    await expect(repo.findExpiredSubscriptions(NOW)).resolves.toEqual([
      { id: 'b2', userId: 'u2', name: 'Silver', expiryDate: EXPIRY },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'PAID', expiryDate: { lte: NOW }, canceledAt: null },
      select: {
        id: true,
        userId: true,
        expiryDate: true,
        subscription: { select: { name: true } },
      },
    });
  });
});
