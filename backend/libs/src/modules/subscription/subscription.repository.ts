import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { SubscriptionEntity, subscriptionSelect, mapSubscription } from './entities/subscription.entity';

@Injectable()
export class SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapUnique(e: unknown): void {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Subscription slug already exists');
    }
  }

  async findById(id: string): Promise<SubscriptionEntity> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, deletedAt: null },
      select: subscriptionSelect,
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return mapSubscription(subscription);
  }

  // Self-service: paket aktif = Subscription dari Billing non-CANCELED terbaru milik user.
  async findMineByUser(userId: string): Promise<SubscriptionEntity | null> {
    const billing = await this.prisma.billing.findFirst({
      where: { userId, status: { not: 'CANCELED' }, subscription: { deletedAt: null } },
      orderBy: [{ createdAt: 'desc' }, { paidAt: 'desc' }],
      select: { subscription: { select: subscriptionSelect } },
    });
    return billing ? mapSubscription(billing.subscription) : null;
  }

  async findMany(params: {
    where: Prisma.SubscriptionWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.SubscriptionOrderByWithRelationInput;
  }): Promise<{ items: SubscriptionEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({ ...params, select: subscriptionSelect }),
      this.prisma.subscription.count({ where: params.where }),
    ]);
    return { items: items.map(mapSubscription), total };
  }

  async create(data: Prisma.SubscriptionCreateInput): Promise<SubscriptionEntity> {
    try {
      return mapSubscription(await this.prisma.subscription.create({ data, select: subscriptionSelect }));
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  async update(id: string, data: Prisma.SubscriptionUpdateInput): Promise<SubscriptionEntity> {
    const existing = await this.prisma.subscription.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existing) throw new NotFoundException('Subscription not found');
    try {
      return mapSubscription(
        await this.prisma.subscription.update({ where: { id }, data, select: subscriptionSelect }),
      );
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // Soft-delete: relasi Billing memakai `onDelete: Restrict` → tidak boleh hard delete.
  async remove(id: string): Promise<SubscriptionEntity> {
    const existing = await this.prisma.subscription.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existing) throw new NotFoundException('Subscription not found');
    return mapSubscription(
      await this.prisma.subscription.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: subscriptionSelect,
      }),
    );
  }
}
