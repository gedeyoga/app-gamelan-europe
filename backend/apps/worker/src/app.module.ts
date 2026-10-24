import { Inject, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { LibsModule } from '@app/libs';
import { workerEnvValidationSchema } from '@app/libs/common/config/env.validation';
import {
  NOTIFICATION_QUEUE,
  NotificationJobData,
  NotificationQueue,
} from '@app/libs/modules/notification/notification.queue';
import { HealthController } from './controllers/health.controller';
import { InternalJobsController } from './controllers/internal-jobs.controller';
import { NotificationProcessor } from './processors/notification.processor';

export const NOTIFICATION_WORKER = 'NOTIFICATION_WORKER';
export const NOTIFICATION_WORKER_CONNECTION = 'NOTIFICATION_WORKER_CONNECTION';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: workerEnvValidationSchema }),
    LibsModule,
  ],
  controllers: [HealthController, InternalJobsController],
  providers: [
    NotificationProcessor,
    {
      // BullMQ blocking command: dedicated connection (`maxRetriesPerRequest: null`).
      provide: NOTIFICATION_WORKER_CONNECTION,
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        }),
      inject: [ConfigService],
    },
    {
      provide: NOTIFICATION_WORKER,
      useFactory: (config: ConfigService, connection: Redis, processor: NotificationProcessor) => {
        const worker = new Worker<NotificationJobData>(
          NOTIFICATION_QUEUE,
          (job) => processor.handle(job),
          {
            connection,
            concurrency: Number(config.get<number>('NOTIFICATION_WORKER_CONCURRENCY') ?? 5),
          },
        );
        worker.on('failed', (job, error) => {
          void processor.onFailed(job, error).catch(() => undefined);
        });
        return worker;
      },
      inject: [ConfigService, NOTIFICATION_WORKER_CONNECTION, NotificationProcessor],
    },
  ],
})
export class AppModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(NOTIFICATION_WORKER) private readonly worker: Worker<NotificationJobData>,
    @Inject(NOTIFICATION_WORKER_CONNECTION) private readonly connection: Redis,
    private readonly notificationQueue: NotificationQueue,
  ) {}

  // Job repeatable (recovery 5 menit + lifecycle 6 jam) didaftarkan sekali saat bootstrap.
  async onModuleInit(): Promise<void> {
    await this.notificationQueue.enqueueRecovery();
    await this.notificationQueue.enqueueSubscriptionLifecycle();
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    try {
      await this.connection.quit();
    } catch {
      // Koneksi sudah tertutup.
    }
  }
}
