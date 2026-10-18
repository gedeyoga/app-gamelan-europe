import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import {
  NOTIFICATION_QUEUE,
  NOTIFICATION_QUEUE_CLIENT,
  NOTIFICATION_QUEUE_CONNECTION,
  NotificationJobData,
  NotificationQueue,
} from './notification.queue';

@Module({
  providers: [
    NotificationRepository,
    NotificationService,
    NotificationQueue,
    {
      // Producer: koneksi dedicated, retry terbatas + offline queue mati → command gagal cepat
      // saat Redis down (request HTTP tidak menggantung). `null` hanya untuk Worker consumer.
      provide: NOTIFICATION_QUEUE_CONNECTION,
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
        }),
      inject: [ConfigService],
    },
    {
      provide: NOTIFICATION_QUEUE_CLIENT,
      useFactory: (connection: Redis) => new Queue<NotificationJobData>(NOTIFICATION_QUEUE, { connection }),
      inject: [NOTIFICATION_QUEUE_CONNECTION],
    },
  ],
  exports: [NotificationRepository, NotificationService, NotificationQueue],
})
export class NotificationModule {}
