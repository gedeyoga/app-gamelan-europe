import { Injectable } from '@nestjs/common';
import { RegionRepository } from './region.repository';
import { RegionEntity } from './entities/region.entity';

@Injectable()
export class RegionService {
  constructor(private readonly regionRepository: RegionRepository) {}

  findMany(): Promise<RegionEntity[]> {
    return this.regionRepository.findMany();
  }
}
