import { Module } from '@nestjs/common';
import { OrganizationModule } from '@app/libs/modules/organization/organization.module';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

@Module({
  imports: [OrganizationModule],
  providers: [EventRepository, EventService],
  exports: [EventRepository, EventService],
})
export class EventModule {}
