import { Injectable, Logger } from '@nestjs/common';
import {
  ArchiveType,
  NotificationChannel,
  NotificationEntityType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { assertAllowedSort, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import {
  BillingEntity,
  SubscriptionLifecycleRow,
  SubscriptionLifecycleRows,
} from '@app/libs/modules/billing/entities/billing.entity';
import { NotificationRepository } from './notification.repository';
import { NotificationQueue } from './notification.queue';
import { NotificationEntity, NotificationPreferenceEntity } from './entities/notification.entity';
import {
  ListNotificationsQueryDto,
  NOTIFICATION_FILTER_FIELDS,
  NOTIFICATION_SORT_FIELDS,
} from './dto/list-notifications-query.dto';
import { buildLinkPath, formatDetails, formatNotificationDate, toExcerpt } from './notification.template';

export { NOTIFICATION_FILTER_FIELDS, NOTIFICATION_SORT_FIELDS };

const DAY_MS = 86_400_000;
export const SUBSCRIPTION_LIFECYCLE_LINK = '/my-billings';

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
  // Detail request (label/value) → kolom `body` sebagai baris `Label: value`.
  details?: Array<{ label: string; value: string | null | undefined }>;
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
      const body = formatDetails(input.details) ?? toExcerpt(input.body);
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
            body,
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
  // Pengecualian: UnknownRequestError tidak punya `code`; penyebab asli (mis. 22P02 enum
  // belum dimigrasi) hanya ada di message. Parameter query tidak ikut, jadi aman dilog.
  private errorTag(e: unknown): string {
    const err = e as { name?: string; code?: string; message?: string };
    const name = err?.name ?? 'Error';
    const code = err?.code ? `:${err.code}` : '';
    if (name === 'PrismaClientUnknownRequestError' && err.message) {
      return `${name}${code}: ${err.message.replace(/\s+/g, ' ').slice(0, 300)}`;
    }
    return `${name}${code}`;
  }

  // Best-effort: dipanggil setelah approve; gagal notifikasi tidak boleh membatalkan approval.
  async notifySubscriptionActive(billing: BillingEntity): Promise<void> {
    try {
      const row = this.subscriptionRow(
        NotificationType.SUBSCRIPTION_ACTIVE,
        {
          id: billing.id,
          userId: billing.userId,
          name: billing.subscription.name,
          expiryDate: billing.expiryDate,
        },
        new Date(),
      );
      if (!row) return;
      const created = await this.repository.createMany(undefined, [row]);
      if (created === 0) return;
      await this.enqueuePending(NotificationEntityType.SUBSCRIPTION, billing.id);
    } catch (e) {
      this.logger.warn(`Subscription active notification failed for ${billing.id}: ${this.errorTag(e)}`);
    }
  }

  // Best-effort: admin membatalkan billing → email SUBSCRIPTION_CANCELED ke pemilik.
  // `expiryDate` sudah null saat ini, jadi detail hanya Package + Canceled on.
  async notifySubscriptionCanceled(billing: BillingEntity): Promise<void> {
    try {
      const row: Prisma.NotificationCreateManyInput = {
        userId: billing.userId,
        type: NotificationType.SUBSCRIPTION_CANCELED,
        entityType: NotificationEntityType.SUBSCRIPTION,
        entityId: billing.id,
        title: billing.subscription.name,
        body: formatDetails([
          { label: 'Package', value: billing.subscription.name },
          {
            label: 'Canceled on',
            value: formatNotificationDate(billing.canceledAt ?? new Date()),
          },
        ]),
        linkPath: SUBSCRIPTION_LIFECYCLE_LINK,
        scheduledAt: new Date(),
      };
      const created = await this.repository.createMany(undefined, [row]);
      if (created === 0) return;
      await this.enqueuePending(NotificationEntityType.SUBSCRIPTION, billing.id);
    } catch (e) {
      this.logger.warn(`Subscription canceled notification failed for ${billing.id}: ${this.errorTag(e)}`);
    }
  }

  // Job berkala: EXPIRING (≤7 hari) + EXPIRED (PAID, belum dibatalkan). Idempoten via unique key.
  // Baris dirakit BillingService.findSubscriptionLifecycleRows (notification tidak query billing).
  async enqueueSubscriptionLifecycle(
    { expiring, expired }: SubscriptionLifecycleRows,
    now = new Date(),
  ): Promise<number> {
    try {
      const rows = (
        [
          ...expiring.map((row) => ({ row, type: NotificationType.SUBSCRIPTION_EXPIRING })),
          ...expired.map((row) => ({ row, type: NotificationType.SUBSCRIPTION_EXPIRED })),
        ] as Array<{ row: SubscriptionLifecycleRow & { expiryDate: Date }; type: NotificationType }>
      )
        .map(({ row, type }) => this.subscriptionRow(type, row, now))
        .filter((row): row is Prisma.NotificationCreateManyInput => row !== null);
      if (rows.length === 0) return 0;
      const created = await this.repository.createMany(undefined, rows);
      // Reuse `enqueuePending` (row PENDING per entity); `jobId` + skipDuplicates menahan duplikat.
      for (const entityId of new Set(rows.map((row) => row.entityId))) {
        await this.enqueuePending(NotificationEntityType.SUBSCRIPTION, entityId);
      }
      return created;
    } catch (e) {
      this.logger.warn(`Subscription lifecycle notification failed: ${this.errorTag(e)}`);
      return 0;
    }
  }

  private subscriptionRow(
    type: NotificationType,
    row: SubscriptionLifecycleRow,
    now: Date,
  ): Prisma.NotificationCreateManyInput | null {
    if (!row.expiryDate) return null;
    const details = [
      { label: 'Package', value: row.name },
      {
        label: type === NotificationType.SUBSCRIPTION_ACTIVE ? 'Active until' : 'Expires on',
        value: formatNotificationDate(row.expiryDate),
      },
      ...(type === NotificationType.SUBSCRIPTION_EXPIRING
        ? [
            {
              label: 'Days left',
              value: String(Math.max(1, Math.ceil((row.expiryDate.getTime() - now.getTime()) / DAY_MS))),
            },
          ]
        : []),
    ];
    return {
      userId: row.userId,
      type,
      entityType: NotificationEntityType.SUBSCRIPTION,
      entityId: row.id,
      title: row.name,
      body: formatDetails(details),
      linkPath: SUBSCRIPTION_LIFECYCLE_LINK,
      scheduledAt: now,
    };
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
