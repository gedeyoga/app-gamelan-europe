import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { NotificationStatus, UserStatus } from '@prisma/client';
import {
  NOTIFICATION_JOB_RECOVER,
  NOTIFICATION_JOB_SEND,
  NotificationJobData,
  NotificationQueue,
} from '@app/libs/modules/notification/notification.queue';
import { NotificationRepository } from '@app/libs/modules/notification/notification.repository';
import { buildContentUrl, renderNotification } from '@app/libs/modules/notification/notification.template';
import { SmtpService } from '@app/libs/integrations/mail/smtp.service';

@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);
  private warnedMissingWebUrl = false;

  constructor(
    private readonly repository: NotificationRepository,
    private readonly queue: NotificationQueue,
    private readonly smtp: SmtpService,
    private readonly config: ConfigService,
  ) {}

  async handle(job: Job<NotificationJobData>): Promise<void> {
    if (job.name === NOTIFICATION_JOB_RECOVER) {
      const rows = await this.repository.findDue(100);
      await this.queue.enqueueDue(rows);
      return;
    }
    if (job.name === NOTIFICATION_JOB_SEND) {
      await this.send(String(job.data?.notificationId ?? ''));
    }
  }

  private async send(notificationId: string): Promise<void> {
    if (!notificationId) return;
    const row = await this.repository.findByIdForSend(notificationId);
    if (!row) return;
    // Re-delivery/idempotensi: row non-PENDING sudah diputuskan sebelumnya.
    if (row.status !== NotificationStatus.PENDING) return;

    const disabled = row.user.notificationPreferences.some(
      (preference) => preference.type === row.type && !preference.emailEnabled,
    );
    if (row.user.status !== UserStatus.ACTIVE || disabled) {
      await this.repository.markSkipped(row.id);
      this.logger.log(`Notification ${row.id} skipped`);
      return;
    }

    // Dev tanpa SMTP: jangan bakar retry / FAILED; row tetap PENDING untuk recovery.
    if (!this.smtp.isConfigured()) {
      this.logger.warn(`Notification ${row.id} left PENDING: SMTP not configured`);
      return;
    }

    const baseUrl = this.config.get<string>('APP_WEB_URL');
    if (!baseUrl && !this.warnedMissingWebUrl) {
      this.warnedMissingWebUrl = true;
      this.logger.warn('APP_WEB_URL not set: notification emails will be sent without a link');
    }
    const url = buildContentUrl(baseUrl, row.linkPath);
    const rendered = renderNotification({
      type: row.type,
      entityType: row.entityType,
      title: row.title,
      excerpt: row.body,
      url,
      imageUrl: row.imageUrl,
    });
    await this.smtp.send({ to: row.user.email, ...rendered });
    await this.repository.markSent(row.id, new Date());
    this.logger.log(`Notification ${row.id} sent`);
  }

  // Dipanggil dari event `failed` Worker. Hanya attempt final yang menandai FAILED.
  async onFailed(job: Job<NotificationJobData> | undefined, error: Error): Promise<void> {
    if (!job || job.name !== NOTIFICATION_JOB_SEND) return;
    const attempts = job.opts.attempts ?? 3;
    if (job.attemptsMade < attempts) return;
    const id = String(job.data?.notificationId ?? '');
    if (!id) return;
    await this.repository.markFailed(id, safeErrorName(error));
    this.logger.warn(`Notification ${id} failed after ${job.attemptsMade} attempt(s)`);
  }
}

// Hanya nama/kode error (≤200 char), tanpa email/kredensial/body SMTP.
export function safeErrorName(error: unknown): string {
  const e = error as { name?: string; code?: string };
  const name = e?.name || 'Error';
  const code = e?.code ? `:${e.code}` : '';
  return `${name}${code}`.slice(0, 200);
}
