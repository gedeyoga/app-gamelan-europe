import { Module } from '@nestjs/common';
import { NetworkRepository } from './network.repository';
import { NetworkService } from './network.service';

@Module({
  providers: [NetworkRepository, NetworkService],
  exports: [NetworkRepository, NetworkService],
})
export class NetworkModule {}
