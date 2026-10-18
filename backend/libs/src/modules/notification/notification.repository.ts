import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingStatus,
  NotificationChannel,
  NotificationEntityType,
  NotificationStatus,
  NotificationType,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import {
  notificationPreferenceSelect,
  notificationSelect,
  notificationSendSelect,
  NotificationEntity,
  NotificationPreferenceEntity,
  NotificationQueueRow,
  NotificationSendEntity,
} from './entities/notification.entity';

export interface RecipientInput {
  creatorId?: string | null;
  authorIds: string[];
  memberOnly: boolean;
  now: Date;
}

// Pure agar filter recipient mudah diuji tanpa DB.
export function buildRecipientWhere(input: RecipientInput): Prisma.UserWhereInput {
  const excluded = [input.creatorId, ...input.authorIds].filter((id): id is string => Boolean(id));
  return {
    status: UserStatus.ACTIVE,
    role: { code: { in: ['member', 'author'] } },
    notificationPreferences: {
      none: {
        type: NotificationType.CONTENT_PUBLISHED,
        channel: NotificationChannel.EMAIL,
        emailEnabled: false,
      },
    },
    ...(excluded.length > 0 ? { id: { notIn: [...new Set(excluded)] } } : {}),
    ...(input.memberOnly
      ? { billings: { some: { status: BillingStatus.PAID, expiryDate: { gt: input.now } } } }
      : {}),
  };
}

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient | PrismaService {
    return tx ?? this.prisma;
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async findAuthorIds(
    tx: Prisma.TransactionClient | undefined,
    entityType: NotificationEntityType,
    entityId: string,
  ): Promise<string[]> {
    const client = this.client(tx);
    if (entityType === NotificationEntityType.POST) {
      const rows = await client.postAuthor.findMany({ where: { postId: entityId }, select: { authorId: true } });
      return rows.map((row) => row.authorId);
    }
    if (entityType === NotificationEntityType.EVENT) {
      const rows = await client.eventAuthor.findMany({ where: { eventId: entityId }, select: { authorId: true } });
      return rows.map((row) => row.authorId);
    }
    const rows = await client.archiveAuthor.findMany({ where: { archiveId: entityId }, select: { authorId: true } });
    return rows.map((row) => row.authorId);
  }

  async findRecipientIds(tx: Prisma.TransactionClient | undefined, input: RecipientInput): Promise<string[]> {
    const rows = await this.client(tx).user.findMany({
      where: buildRecipientWhere(input),
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async findAdminRecipientIds(
    tx: Prisma.TransactionClient | undefined,
    type: NotificationType,
  ): Promise<string[]> {
    const rows = await this.client(tx).user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: { code: 'admin' },
        notificationPreferences: {
          none: { type, channel: NotificationChannel.EMAIL, emailEnabled: false },
        },
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async createMany(tx: Prisma.TransactionClient | undefined, data: Prisma.NotificationCreateManyInput[]): Promise<number> {
    if (data.length === 0) return 0;
    const result = await this.client(tx).notification.createMany({ data, skipDuplicates: true });
    return result.count;
  }

  async findPendingByEntity(entityType: NotificationEntityType, entityId: string): Promise<NotificationQueueRow[]> {
    return this.prisma.notification.findMany({
      where: { entityType, entityId, status: NotificationStatus.PENDING },
      select: { id: true, scheduledAt: true },
    });
  }

  async findDue(limit: number): Promise<NotificationQueueRow[]> {
    return this.prisma.notification.findMany({
      where: { status: NotificationStatus.PENDING, scheduledAt: { lte: new Date() } },
      select: { id: true, scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
  }

  async findByIdForSend(id: string): Promise<NotificationSendEntity | null> {
    return this.prisma.notification.findUnique({ where: { id }, select: notificationSendSelect });
  }

  async markSent(id: string, sentAt: Date): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.SENT, sentAt, lastError: null },
    });
  }

  async markSkipped(id: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.SKIPPED },
    });
  }

  // Hanya PENDING: jangan menimpa SENT bila `markSent` sudah sukses tapi langkah lain gagal.
  async markFailed(id: string, lastError: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, status: NotificationStatus.PENDING },
      data: { status: NotificationStatus.FAILED, lastError },
    });
  }

  async findManyForUser(params: {
    userId: string;
    status?: NotificationStatus;
    unread?: boolean;
    skip: number;
    take: number;
    orderBy: Prisma.NotificationOrderByWithRelationInput;
  }): Promise<{ items: NotificationEntity[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      userId: params.userId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.unread ? { readAt: null } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
        select: notificationSelect,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  // 404 bila bukan milik user (tidak membocorkan keberadaan row).
  async markRead(userId: string, id: string, now: Date): Promise<NotificationEntity> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: notificationSelect,
    });
    if (!existing) throw new NotFoundException('Notification not found');
    if (existing.readAt) return existing;
    await this.prisma.notification.update({ where: { id }, data: { readAt: now } });
    return { ...existing, readAt: now };
  }

  async markAllRead(userId: string, now: Date): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now },
    });
    return result.count;
  }

  findPreferences(userId: string): Promise<NotificationPreferenceEntity[]> {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
      select: notificationPreferenceSelect,
    });
  }

  upsertPreference(
    userId: string,
    type: NotificationType,
    emailEnabled: boolean,
  ): Promise<NotificationPreferenceEntity> {
    return this.prisma.notificationPreference.upsert({
      where: { userId_type_channel: { userId, type, channel: NotificationChannel.EMAIL } },
      create: { userId, type, channel: NotificationChannel.EMAIL, emailEnabled },
      update: { emailEnabled },
      select: notificationPreferenceSelect,
    });
  }
}
