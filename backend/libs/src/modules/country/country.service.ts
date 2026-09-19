import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { CountryRepository } from './country.repository';
import { CountryEntity } from './entities/country.entity';

export const COUNTRY_FILTER_FIELDS = ['name', 'iso2', 'iso3', 'regionId', 'createdAt', 'updatedAt'];
export const COUNTRY_DATE_FIELDS = ['createdAt', 'updatedAt'];
export const COUNTRY_NUMBER_FIELDS = ['regionId'];
// Semua kolom yang ditampilkan di menu Countries wajib sortable.
export const COUNTRY_SORT_FIELDS = ['name', 'iso2', 'iso3', 'regionName', 'population', 'createdAt', 'updatedAt'];
// Global search bar menu Countries: OR like ke kolom-kolom ini.
export const COUNTRY_SEARCHABLE_FIELDS = ['name', 'iso2', 'iso3', 'native', 'capital', 'nationality'];

@Injectable()
export class CountryService {
  constructor(private readonly countryRepository: CountryRepository) {}

  async list(query: ListQueryDto): Promise<{ items: CountryEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, COUNTRY_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.CountryWhereInput>(query.filter, COUNTRY_FILTER_FIELDS, {
      dateFields: COUNTRY_DATE_FIELDS,
      numberFields: COUNTRY_NUMBER_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.CountryWhereInput>(query.search, COUNTRY_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.CountryWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.countryRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.CountryOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  findById(id: number): Promise<CountryEntity> {
    return this.countryRepository.findById(id);
  }
}
