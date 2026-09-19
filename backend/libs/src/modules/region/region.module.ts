import { Module } from '@nestjs/common';
import { RegionRepository } from './region.repository';
import { RegionService } from './region.service';

@Module({
  providers: [RegionRepository, RegionService],
  exports: [RegionRepository, RegionService],
})
export class RegionModule {}
