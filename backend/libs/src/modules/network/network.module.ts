import { Module } from '@nestjs/common';
import { CountryModule } from '@app/libs/modules/country/country.module';
import { StateModule } from '@app/libs/modules/state/state.module';
import { CityModule } from '@app/libs/modules/city/city.module';
import { NotificationModule } from '@app/libs/modules/notification/notification.module';
import { NetworkRepository } from './network.repository';
import { NetworkService } from './network.service';

@Module({
  imports: [CountryModule, StateModule, CityModule, NotificationModule],
  providers: [NetworkRepository, NetworkService],
  exports: [NetworkRepository, NetworkService],
})
export class NetworkModule {}
