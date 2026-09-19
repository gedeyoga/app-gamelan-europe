import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { RegionEntity, regionSelect } from './entities/region.entity';

@Injectable()
export class RegionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(): Promise<RegionEntity[]> {
    return this.prisma.region.findMany({ orderBy: { name: 'asc' }, select: regionSelect });
  }
}
