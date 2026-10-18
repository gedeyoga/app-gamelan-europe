import { Injectable, Logger } from '@nestjs/common';
import {
  ArchiveType,
  NotificationChannel,
  NotificationEntityType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { assertAllowedSort, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { NotificationRepository } from './notification.repository';
import { NotificationQueue } from './notification.queue';
import { NotificationEntity, NotificationPreferenceEntity } from './entities/notification.entity';
import {
  ListNotificationsQueryDto,
  NOTIFICATION_FILTER_FIELDS,
  NOTIFICATION_SORT_FIELDS,
} from './dto/list-notifications-query.dto';
import { buildLinkPath, toExcerpt } from './notification.template';

export { NOTIFICATION_FILTER_FIELDS, NOTIFICATION_SORT_FIELDS };

export interface EnqueueContentPublishedInput {
  entityType: NotificationEntityType;
  entityId: string;
  title: string;
  // Konten mentah (HTML/teks); service membuat excerpt plain text ≤300 char.
  body?: string | null;
  imageUrl?: string | null;
  slug?: string | null;
  publishedAt?: Date | null;
  // Default true (checkbox FE); false → tidak membuat row.
  notify?: boolean;
  // Pelaku publish/penulis konten; dikecualikan dari recipient.
  actorId?: string | null;
  // Hanya ARCHIVE: MEMBER → recipient wajib punya billing aktif.
  archiveType?: ArchiveType | null;
}

export interface NotifyAdminsInput {
  type: NotificationType;
  entityType: NotificationEntityType;
  entityId: string;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  linkPath?: string | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly repository: NotificationRepository,
    private readonly queue: NotificationQueue,
  ) {}

  // Dipanggil DI DALAM transaksi publish; idempoten via unique key + skipDuplicates.
  async enqueueContentPublished(
    tx: Prisma.TransactionClient,
    input: EnqueueContentPublishedInput,
  ): Promise<number> {
    if (input.notify === false) return 0;

    const now = new Date();
    const authorIds = await this.repository.findAuthorIds(tx, input.entityType, input.entityId);
    const recipientIds = await this.repository.findRecipientIds(tx, {
      creatorId: input.actorId,
      authorIds,
      memberOnly: input.entityType === NotificationEntityType.ARCHIVE && input.archiveType === ArchiveType.MEMBER,
      now,
    });
    if (recipientIds.length === 0) return 0;

    const publishedAt = input.publishedAt ?? null;
    const scheduledAt = publishedAt && publishedAt.getTime() > now.getTime() ? publishedAt : now;
    const linkPath = buildLinkPath(input.entityType, input.slug);
    const body = toExcerpt(input.body);

    return this.repository.createMany(
      tx,
      recipientIds.map((userId) => ({
        userId,
        type: NotificationType.CONTENT_PUBLISHED,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        body,
        imageUrl: input.imageUrl ?? null,
        linkPath,
        scheduledAt,
      })),
    );
  }

  // Submission baru (konten/langganan) → semua admin ACTIVE. Best-effort: jangan gagalkan request.
  async notifyAdmins(input: NotifyAdminsInput): Promise<void> {
    try {
      const created = await this.repository.transaction(async (tx) => {
        const recipientIds = await this.repository.findAdminRecipientIds(tx, input.type);
        if (recipientIds.length === 0) return 0;
        return this.repository.createMany(
          tx,
          recipientIds.map((userId) => ({
            userId,
            type: input.type,
            entityType: input.entityType,
            entityId: input.entityId,
            title: input.title,
            body: toExcerpt(input.body),
            imageUrl: input.imageUrl ?? null,
            linkPath: input.linkPath ?? null,
            scheduledAt: new Date(),
          })),
        );
      });
      if (created === 0) return;
      await this.enqueuePending(input.entityType, input.entityId);
    } catch (e) {
      this.logger.warn(
        `Admin notification failed for ${input.entityType} ${input.entityId}: ${this.errorTag(e)}`,
      );
    }
  }

  // Nama/kode error saja — pesan Prisma bisa memuat potongan konten.
  private errorTag(e: unknown): string {
    const err = e as { name?: string; code?: string };
    return `${err?.name ?? 'Error'}${err?.code ? `:${err.code}` : ''}`;
  }

  // Create/update auto-publish: buka transaksi sendiri, jangan gagalkan request bila notifikasi gagal.
  async publishAfterCommit(input: EnqueueContentPublishedInput): Promise<void> {
    if (input.notify === false) return;
    try {
      await this.repository.transaction((tx) => this.enqueueContentPublished(tx, input));
      await this.queue.enqueuePending(input.entityType, input.entityId);
    } catch (e) {
      this.logger.warn(
        `Notification enqueue failed for ${input.entityType} ${input.entityId}: ${this.errorTag(e)}`,
      );
    }
  }

  // SETELAH commit; gagal enqueue tidak menggagalkan publish (row tetap PENDING untuk recovery).
  async enqueuePending(entityType: NotificationEntityType, entityId: string): Promise<void> {
    try {
      await this.queue.enqueuePending(entityType, entityId);
    } catch (e) {
      this.logger.warn(`Notification queue unavailable for ${entityType} ${entityId}: ${this.errorTag(e)}`);
    }
  }

  async list(
    query: ListNotificationsQueryDto,
    userId: string,
  ): Promise<{ items: NotificationEntity[]; total: number }> {
    assertAllowedSort(query.sortBy, NOTIFICATION_SORT_FIELDS);
    const take = Math.min(query.limit, 100);
    return this.repository.findManyForUser({
      userId,
      status: query.status,
      unread: query.unread,
      skip: (query.page - 1) * take,
      take,
      orderBy: buildOrderBy<Prisma.NotificationOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  markRead(userId: string, id: string): Promise<NotificationEntity> {
    return this.repository.markRead(userId, id, new Date());
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    return { updated: await this.repository.markAllRead(userId, new Date()) };
  }

  // Response selalu lengkap: semua NotificationType × EMAIL; baris absen = enabled.
  async getPreferences(userId: string): Promise<NotificationPreferenceEntity[]> {
    const rows = await this.repository.findPreferences(userId);
    const enabledByType = new Map(
      rows
        .filter((row) => row.channel === NotificationChannel.EMAIL)
        .map((row) => [row.type, row.emailEnabled]),
    );
    return Object.values(NotificationType).map((type) => ({
      type,
      channel: NotificationChannel.EMAIL,
      emailEnabled: enabledByType.get(type) ?? true,
    }));
  }

  updatePreference(
    userId: string,
    type: NotificationType,
    emailEnabled: boolean,
  ): Promise<NotificationPreferenceEntity> {
    return this.repository.upsertPreference(userId, type, emailEnabled);
  }
}
