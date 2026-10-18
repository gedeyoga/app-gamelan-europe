import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionRequestStatus, SubscriptionRequestType } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import {
  SubscriptionRequestEntity,
  mapSubscriptionRequest,
  subscriptionRequestSelect,
} from './entities/subscription-request.entity';

export interface CreateSubscriptionRequestData {
  userId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  country?: string | null;
  organisation?: string | null;
  reason: string;
  subscriptionId: string;
  requestType: SubscriptionRequestType;
}

// Field minimum untuk memutuskan review (tidak keluar ke API).
export interface SubscriptionRequestReviewRow {
  id: string;
  status: SubscriptionRequestStatus;
  userId: string | null;
  subscriptionId: string;
  fullName: string;
  email: string;
}

export interface UserContact {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null;
  roleId: string | null;
}

@Injectable()
export class SubscriptionRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SubscriptionRequestEntity> {
    const row = await this.prisma.subscriptionRequest.findUnique({
      where: { id },
      select: subscriptionRequestSelect,
    });
    if (!row) throw new NotFoundException('Subscription request not found');
    return mapSubscriptionRequest(row);
  }

  findForReview(id: string): Promise<SubscriptionRequestReviewRow | null> {
    return this.prisma.subscriptionRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        userId: true,
        subscriptionId: true,
        fullName: true,
        email: true,
      },
    });
  }

  async findMany(params: {
    where: Prisma.SubscriptionRequestWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.SubscriptionRequestOrderByWithRelationInput;
  }): Promise<{ items: SubscriptionRequestEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscriptionRequest.findMany({ ...params, select: subscriptionRequestSelect }),
      this.prisma.subscriptionRequest.count({ where: params.where }),
    ]);
    return { items: items.map(mapSubscriptionRequest), total };
  }

  async create(data: CreateSubscriptionRequestData): Promise<SubscriptionRequestEntity> {
    const created = await this.prisma.subscriptionRequest.create({
      data: data as Prisma.SubscriptionRequestUncheckedCreateInput,
      select: subscriptionRequestSelect,
    });
    return mapSubscriptionRequest(created);
  }

  // Atomic claim: hanya menang bila baris masih PENDING → cegah double-approve paralel.
  claimPending(
    id: string,
    data: { reviewedById: string; reviewedAt: Date; reviewNote: string | null },
  ): Promise<{ count: number }> {
    return this.prisma.subscriptionRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'APPROVED', ...data },
    });
  }

  claimRejected(
    id: string,
    data: { reviewedById: string; reviewedAt: Date; reviewNote: string | null },
  ): Promise<{ count: number }> {
    return this.prisma.subscriptionRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', ...data },
    });
  }

  async setBillingId(id: string, billingId: string): Promise<SubscriptionRequestEntity> {
    const updated = await this.prisma.subscriptionRequest.update({
      where: { id },
      data: { billingId },
      select: subscriptionRequestSelect,
    });
    return mapSubscriptionRequest(updated);
  }

  // Compensating rollback: kembalikan ke PENDING polos setelah claim (mis. billing gagal).
  async revertPending(id: string): Promise<void> {
    await this.prisma.subscriptionRequest.update({
      where: { id },
      data: { status: 'PENDING', billingId: null, reviewedById: null, reviewedAt: null, reviewNote: null },
    });
  }

  // Cross-table: subscription aktif & belum soft-deleted → { id, name } | null.
  findActiveSubscription(id: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.subscription.findFirst({
      where: { id, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
  }

  // Cross-table: kontak + role user (untuk resolve requester saat approve / createMine).
  findUserContact(id: string): Promise<UserContact | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, email: true, phone: true, address: true, roleId: true },
    });
  }

  findRoleIdByCode(code: string): Promise<{ id: string } | null> {
    return this.prisma.role.findUnique({ where: { code }, select: { id: true } });
  }

  setUserRole(userId: string, roleId: string): Promise<{ id: string }> {
    return this.prisma.user.update({ where: { id: userId }, data: { roleId }, select: { id: true } });
  }
}
