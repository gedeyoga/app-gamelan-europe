import { Module } from '@nestjs/common';
import { EventTypeRepository } from './event-type.repository';
import { EventTypeService } from './event-type.service';

@Module({
  providers: [EventTypeRepository, EventTypeService],
  exports: [EventTypeRepository, EventTypeService],
})
export class EventTypeModule {}
