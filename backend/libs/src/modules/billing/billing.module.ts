import { Module } from '@nestjs/common';
import { NotificationModule } from '@app/libs/modules/notification/notification.module';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';

@Module({
  imports: [NotificationModule],
  providers: [BillingRepository, BillingService],
  exports: [BillingRepository, BillingService],
})
export class BillingModule {}
