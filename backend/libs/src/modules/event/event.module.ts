import { Module } from '@nestjs/common';
import { NetworkModule } from '@app/libs/modules/network/network.module';
import { UserModule } from '@app/libs/modules/user/user.module';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

@Module({
  imports: [NetworkModule, UserModule],
  providers: [EventRepository, EventService],
  exports: [EventRepository, EventService],
})
export class EventModule {}
