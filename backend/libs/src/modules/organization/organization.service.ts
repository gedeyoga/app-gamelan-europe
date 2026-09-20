import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { OrganizationRepository } from './organization.repository';
import { OrganizationEntity } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

export const ORGANIZATION_SEARCHABLE_FIELDS = ['name', 'city', 'country', 'address'];
export const ORGANIZATION_SORT_FIELDS = ['name', 'city', 'country', 'address', 'createdAt', 'updatedAt'];
export const ORGANIZATION_FILTER_FIELDS = ['name', 'city', 'country', 'createdAt', 'updatedAt'];
export const ORGANIZATION_DATE_FIELDS = ['createdAt', 'updatedAt'];

@Injectable()
export class OrganizationService {
  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async list(query: ListQueryDto): Promise<{ items: OrganizationEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, ORGANIZATION_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.OrganizationWhereInput>(query.filter, ORGANIZATION_FILTER_FIELDS, {
      dateFields: ORGANIZATION_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.OrganizationWhereInput>(query.search, ORGANIZATION_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.OrganizationWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.organizationRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.OrganizationOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  findOne(id: string): Promise<OrganizationEntity> {
    return this.organizationRepository.findById(id);
  }

  create(dto: CreateOrganizationDto): Promise<OrganizationEntity> {
    return this.organizationRepository.create({
      name: dto.name,
      city: dto.city,
      country: dto.country,
      address: dto.address,
      lat: dto.lat,
      lng: dto.lng,
    });
  }

  update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationEntity> {
    const data: Prisma.OrganizationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }
    return this.organizationRepository.update(id, data);
  }

  remove(id: string): Promise<OrganizationEntity> {
    return this.organizationRepository.remove(id);
  }
}
