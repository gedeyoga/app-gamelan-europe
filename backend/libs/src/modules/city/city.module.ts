import { Module } from '@nestjs/common';
import { CountryModule } from '@app/libs/modules/country/country.module';
import { StateModule } from '@app/libs/modules/state/state.module';
import { CityRepository } from './city.repository';
import { CityService } from './city.service';

@Module({
  imports: [CountryModule, StateModule],
  providers: [CityRepository, CityService],
  exports: [CityRepository, CityService],
})
export class CityModule {}
