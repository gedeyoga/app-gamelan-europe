import { Module } from '@nestjs/common';
import { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

@Module({
  providers: [StatsRepository, StatsService],
  exports: [StatsService],
})
export class StatsModule {}
