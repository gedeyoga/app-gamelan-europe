import { Module } from '@nestjs/common';
import { CountryModule } from '@app/libs/modules/country/country.module';
import { StateRepository } from './state.repository';
import { StateService } from './state.service';

@Module({
  imports: [CountryModule],
  providers: [StateRepository, StateService],
  exports: [StateRepository, StateService],
})
export class StateModule {}
