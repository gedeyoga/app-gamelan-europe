import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { NotificationEntityType } from '@prisma/client';
import { NotificationRepository } from './notification.repository';
import { NotificationQueueRow } from './entities/notification.entity';

export const NOTIFICATION_QUEUE = 'notifications';
export const NOTIFICATION_JOB_SEND = 'send';
export const NOTIFICATION_JOB_RECOVER = 'recover';
export const NOTIFICATION_RECOVERY_EVERY_MS = 300_000;

export const NOTIFICATION_QUEUE_CLIENT = 'NOTIFICATION_QUEUE_CLIENT';
export const NOTIFICATION_QUEUE_CONNECTION = 'NOTIFICATION_QUEUE_CONNECTION';

export interface NotificationJobData {
  notificationId?: string;
}

export const NOTIFICATION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 60_000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

type QueueClient = Queue<NotificationJobData>;

@Injectable()
export class NotificationQueue implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueue.name);

  constructor(
    @Inject(NOTIFICATION_QUEUE_CLIENT) private readonly queue: QueueClient,
    @Inject(NOTIFICATION_QUEUE_CONNECTION) private readonly connection: Redis,
    private readonly repository: NotificationRepository,
  ) {}

  // Job delayed dihitung ulang tiap enqueue (recovery memakai `scheduledAt` terkini).
  private toJob(row: NotificationQueueRow) {
    return {
      name: NOTIFICATION_JOB_SEND,
      data: { notificationId: row.id },
      opts: {
        ...NOTIFICATION_JOB_OPTIONS,
        jobId: row.id,
        delay: Math.max(0, row.scheduledAt.getTime() - Date.now()),
      },
    };
  }

  async enqueuePending(entityType: NotificationEntityType, entityId: string): Promise<void> {
    const rows = await this.repository.findPendingByEntity(entityType, entityId);
    if (rows.length === 0) return;
    await this.queue.addBulk(rows.map((row) => this.toJob(row)));
  }

  // Recovery: job terminal (completed/failed) dengan `jobId` sama menahan enqueue ulang → hapus dulu.
  async enqueueDue(rows: NotificationQueueRow[]): Promise<void> {
    if (rows.length === 0) return;
    for (const row of rows) {
      // Race-safe: job bisa hilang/berubah state di antara getJob & remove → lewati saja.
      try {
        const existing = await this.queue.getJob(row.id);
        if (existing) {
          const state = await existing.getState();
          if (state === 'completed' || state === 'failed') await existing.remove();
        }
      } catch (e) {
        this.logger.warn(`Notification job cleanup skipped for ${row.id}: ${(e as Error).name}`);
      }
    }
    await this.queue.addBulk(rows.map((row) => this.toJob(row)));
  }

  async enqueueRecovery(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        `${NOTIFICATION_QUEUE}-recovery`,
        { every: NOTIFICATION_RECOVERY_EVERY_MS },
        { name: NOTIFICATION_JOB_RECOVER, data: {}, opts: { removeOnComplete: true } },
      );
    } catch (e) {
      // Redis mati tidak boleh menggagalkan boot; scheduler dibuat ulang saat worker restart.
      this.logger.warn(`Notification recovery scheduler not registered: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.queue.close();
      await this.connection.quit();
    } catch {
      // Koneksi/queue sudah tertutup.
    }
  }
}
