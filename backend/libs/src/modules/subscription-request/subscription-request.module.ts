import { Module } from '@nestjs/common';
import { BillingModule } from '@app/libs/modules/billing/billing.module';
import { UserModule } from '@app/libs/modules/user/user.module';
import { NotificationModule } from '@app/libs/modules/notification/notification.module';
import { SubscriptionRequestRepository } from './subscription-request.repository';
import { SubscriptionRequestService } from './subscription-request.service';

@Module({
  imports: [BillingModule, UserModule, NotificationModule],
  providers: [SubscriptionRequestRepository, SubscriptionRequestService],
  exports: [SubscriptionRequestService],
})
export class SubscriptionRequestModule {}
