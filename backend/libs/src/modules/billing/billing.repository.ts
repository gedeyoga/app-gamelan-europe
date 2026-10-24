import { randomBytes } from 'crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionType } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { BillingEntity, MemberPayload, SubscriptionLifecycleRow, billingSelect, mapBilling, mapSubscriptionLifecycle, memberSelect, subscriptionLifecycleSelect } from './entities/billing.entity';

// `INV-<yyyyMMdd>-<6 hex acak>`; unik ditegakkan unique constraint + retry.
function generateBillingCode(now: Date): string {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `INV-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export interface SubscribeInput {
  userId: string;
  subscriptionId: string;
  subscriptionType: SubscriptionType;
  currency: string;
  total: number;
  startDate: Date;
  expiryDate: Date;
  now: Date;
  paymentProofUrl?: string;
  paymentProofName?: string;
}

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapUnique(e: unknown): void {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Billing code already exists');
    }
  }

  async findById(id: string): Promise<BillingEntity> {
    const billing = await this.prisma.billing.findUnique({ where: { id }, select: billingSelect });
    if (!billing) throw new NotFoundException('Billing not found');
    return mapBilling(billing);
  }

  async findMany(params: {
    where: Prisma.BillingWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.BillingOrderByWithRelationInput;
  }): Promise<{ items: BillingEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.billing.findMany({ ...params, select: billingSelect }),
      this.prisma.billing.count({ where: params.where }),
    ]);
    return { items: items.map(mapBilling), total };
  }

  // Nested create lines (`lines: { create: [...] }`) ditangani Prisma secara atomik.
  async create(data: Prisma.BillingCreateInput): Promise<BillingEntity> {
    try {
      return mapBilling(await this.prisma.billing.create({ data, select: billingSelect }));
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // `lines === undefined` → lines lama tetap. `lines` array (boleh kosong) → REPLACE seluruh lines.
  async update(
    id: string,
    data: Prisma.BillingUpdateInput,
    lines?: Prisma.BillingLineCreateManyBillingInput[],
  ): Promise<BillingEntity> {
    const existing = await this.prisma.billing.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Billing not found');
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.billing.update({ where: { id }, data });
        }
        if (lines !== undefined) {
          await tx.billingLine.deleteMany({ where: { billingId: id } });
          if (lines.length > 0) {
            await tx.billingLine.createMany({ data: lines.map((line) => ({ ...line, billingId: id })) });
          }
        }
        return mapBilling(await tx.billing.findUniqueOrThrow({ where: { id }, select: billingSelect }));
      });
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // `billing_lines` ikut terhapus via FK `onDelete: Cascade`.
  async remove(id: string): Promise<BillingEntity> {
    const existing = await this.prisma.billing.findUnique({ where: { id }, select: billingSelect });
    if (!existing) throw new NotFoundException('Billing not found');
    await this.prisma.billing.delete({ where: { id } });
    return mapBilling(existing);
  }

  // Cross-table read (user + role + billing terbaru). Sort/paginasi di service (status komputasi).
  findMembers(where: Prisma.UserWhereInput): Promise<MemberPayload[]> {
    return this.prisma.user.findMany({ where, select: memberSelect });
  }

  async findUser(id: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Membership aktif = billing PAID belum kedaluwarsa (mirror mapMemberSubscription ACTIVE).
  async hasActiveByUser(userId: string, now: Date): Promise<boolean> {
    const billing = await this.prisma.billing.findFirst({
      where: { userId, status: 'PAID', expiryDate: { gt: now } },
      select: { id: true },
    });
    return billing !== null;
  }

  // Notifikasi SUBSCRIPTION_EXPIRING: PAID dan expiryDate di (now, until].
  async findExpiringSubscriptions(now: Date, until: Date): Promise<SubscriptionLifecycleRow[]> {
    const rows = await this.prisma.billing.findMany({
      where: { status: 'PAID', expiryDate: { gt: now, lte: until } },
      select: subscriptionLifecycleSelect,
    });
    return rows.map(mapSubscriptionLifecycle);
  }

  // Notifikasi SUBSCRIPTION_EXPIRED: PAID, sudah lewat, tidak dibatalkan.
  async findExpiredSubscriptions(now: Date): Promise<SubscriptionLifecycleRow[]> {
    const rows = await this.prisma.billing.findMany({
      where: { status: 'PAID', expiryDate: { lte: now }, canceledAt: null },
      select: subscriptionLifecycleSelect,
    });
    return rows.map(mapSubscriptionLifecycle);
  }

  async findSubscription(id: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, subscriptionType: true, currency: true, price: true, durationInDays: true },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }

  // Transaksi: batalkan billing PAID lama (→ CANCELED), buat billing baru PAID.
  // `code` unik → P2002 di-retry sekali dengan code baru (jangan 409 ke user).
  async subscribe(input: SubscribeInput): Promise<BillingEntity> {
    const data = {
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      status: 'PAID' as const,
      subscriptionType: input.subscriptionType,
      currency: input.currency,
      total: input.total,
      paidAt: input.now,
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      ...(input.paymentProofUrl !== undefined ? { paymentProofUrl: input.paymentProofUrl } : {}),
      ...(input.paymentProofName !== undefined ? { paymentProofName: input.paymentProofName } : {}),
    };
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          await tx.billing.updateMany({
            where: { userId: input.userId, status: 'PAID' },
            data: { status: 'CANCELED', canceledAt: input.now, expiryDate: null },
          });
          return tx.billing.create({ data: { ...data, code: generateBillingCode(input.now) }, select: billingSelect });
        });
        return mapBilling(created);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt === 0) continue;
        this.mapUnique(e); // percobaan kedua tetap bentrok → 409, bukan 500 mentah
        throw e;
      }
    }
  }

  async cancel(id: string): Promise<BillingEntity> {
    const existing = await this.prisma.billing.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Billing not found');
    return mapBilling(
      await this.prisma.billing.update({
        where: { id },
        data: { status: 'CANCELED', canceledAt: new Date(), expiryDate: null },
        select: billingSelect,
      }),
    );
  }
}
