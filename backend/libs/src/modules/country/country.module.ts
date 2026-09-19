import { Module } from '@nestjs/common';
import { CountryRepository } from './country.repository';
import { CountryService } from './country.service';

@Module({
  providers: [CountryRepository, CountryService],
  exports: [CountryRepository, CountryService],
})
export class CountryModule {}
