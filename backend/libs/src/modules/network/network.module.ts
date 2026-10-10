import { Module } from '@nestjs/common';
import { CountryModule } from '@app/libs/modules/country/country.module';
import { StateModule } from '@app/libs/modules/state/state.module';
import { UserModule } from '@app/libs/modules/user/user.module';
import { NetworkRepository } from './network.repository';
import { NetworkService } from './network.service';

@Module({
  imports: [CountryModule, StateModule, UserModule],
  providers: [NetworkRepository, NetworkService],
  exports: [NetworkRepository, NetworkService],
})
export class NetworkModule {}
