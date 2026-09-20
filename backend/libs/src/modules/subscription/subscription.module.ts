import { Module } from '@nestjs/common';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionService } from './subscription.service';

@Module({
  providers: [SubscriptionRepository, SubscriptionService],
  exports: [SubscriptionRepository, SubscriptionService],
})
export class SubscriptionModule {}
