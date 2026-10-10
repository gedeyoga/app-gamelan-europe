import { Module } from '@nestjs/common';
import { BillingModule } from '@app/libs/modules/billing/billing.module';
import { UserModule } from '@app/libs/modules/user/user.module';
import { SubscriptionRequestRepository } from './subscription-request.repository';
import { SubscriptionRequestService } from './subscription-request.service';

@Module({
  imports: [BillingModule, UserModule],
  providers: [SubscriptionRequestRepository, SubscriptionRequestService],
  exports: [SubscriptionRequestService],
})
export class SubscriptionRequestModule {}
