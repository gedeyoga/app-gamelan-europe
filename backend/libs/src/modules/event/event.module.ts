import { Module } from '@nestjs/common';
import { CountryModule } from '@app/libs/modules/country/country.module';
import { StateModule } from '@app/libs/modules/state/state.module';
import { CityModule } from '@app/libs/modules/city/city.module';
import { EventTypeModule } from '@app/libs/modules/event-type/event-type.module';
import { ImageModule } from '@app/libs/modules/image/image.module';
import { NetworkModule } from '@app/libs/modules/network/network.module';
import { UserModule } from '@app/libs/modules/user/user.module';
import { EventRepository } from './event.repository';
import { EventService } from './event.service';
import { NotificationModule } from '@app/libs/modules/notification/notification.module';

@Module({
  imports: [CountryModule, StateModule, CityModule, EventTypeModule, ImageModule, NetworkModule, UserModule, NotificationModule],
  providers: [EventRepository, EventService],
  exports: [EventRepository, EventService],
})
export class EventModule {}
