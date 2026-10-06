import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { citySelect, cityWithRelationsSelect, CityEntity, CityWithRelationsEntity } from './entities/city.entity';

@Injectable()
export class CityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<CityWithRelationsEntity> {
    const city = await this.prisma.city.findUnique({ where: { id }, select: cityWithRelationsSelect });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  // Non-throwing lookup (validasi body trust boundary).
  async findByIdOrNull(id: number): Promise<CityWithRelationsEntity | null> {
    return this.prisma.city.findUnique({ where: { id }, select: cityWithRelationsSelect });
  }

  async findMany(params: {
    where: Prisma.CityWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.CityOrderByWithRelationInput;
  }): Promise<{ items: CityEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.city.findMany({ ...params, select: citySelect }),
      this.prisma.city.count({ where: params.where }),
    ]);
    return { items, total };
  }

  // Inline-add city: name sama (case-insensitive) + country + state → kembalikan existing (bukan 409).
  async createIdempotent(data: {
    name: string;
    countryId: number;
    stateId: number | null;
  }): Promise<CityEntity> {
    const existing = await this.prisma.city.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        countryId: data.countryId,
        stateId: data.stateId,
      },
      select: citySelect,
    });
    if (existing) return existing;
    return this.prisma.city.create({ data, select: citySelect });
  }
}
