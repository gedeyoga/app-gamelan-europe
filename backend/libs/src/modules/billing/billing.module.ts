import { Module } from '@nestjs/common';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';

@Module({
  providers: [BillingRepository, BillingService],
  exports: [BillingRepository, BillingService],
})
export class BillingModule {}
