import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LibsModule } from '@app/libs';
import { workerEnvValidationSchema } from '@app/libs/common/config/env.validation';
import { HealthController } from './controllers/health.controller';
import { InternalJobsController } from './controllers/internal-jobs.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: workerEnvValidationSchema }),
    LibsModule,
  ],
  controllers: [HealthController, InternalJobsController],
})
export class AppModule {}
