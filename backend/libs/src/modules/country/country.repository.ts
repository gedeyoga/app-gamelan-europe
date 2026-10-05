import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { CountryEntity, countrySelect, toCountryEntity } from './entities/country.entity';

@Injectable()
export class CountryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<CountryEntity> {
    const country = await this.prisma.country.findUnique({ where: { id }, select: countrySelect });
    if (!country) throw new NotFoundException('Country not found');
    return toCountryEntity(country);
  }

  // Non-throwing existence check (validasi body trust boundary).
  async findByIdOrNull(id: number): Promise<CountryEntity | null> {
    const country = await this.prisma.country.findUnique({ where: { id }, select: countrySelect });
    return country ? toCountryEntity(country) : null;
  }

  async findMany(params: {
    where: Prisma.CountryWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.CountryOrderByWithRelationInput;
  }): Promise<{ items: CountryEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.country.findMany({ ...params, select: countrySelect }),
      this.prisma.country.count({ where: params.where }),
    ]);
    return { items: items.map(toCountryEntity), total };
  }
}
