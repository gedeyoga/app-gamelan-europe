import { Module } from '@nestjs/common';
import { CountryModule } from '@app/libs/modules/country/country.module';
import { StateModule } from '@app/libs/modules/state/state.module';
import { EventTypeModule } from '@app/libs/modules/event-type/event-type.module';
import { ImageModule } from '@app/libs/modules/image/image.module';
import { NetworkModule } from '@app/libs/modules/network/network.module';
import { UserModule } from '@app/libs/modules/user/user.module';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';

@Module({
  imports: [CountryModule, StateModule, EventTypeModule, ImageModule, NetworkModule, UserModule],
  providers: [EventRepository, EventService],
  exports: [EventRepository, EventService],
})
export class EventModule {}
