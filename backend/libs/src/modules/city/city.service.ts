import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { CountryRepository } from '@app/libs/modules/country/country.repository';
import { StateRepository } from '@app/libs/modules/state/state.repository';
import { CityRepository } from './city.repository';
import { CityEntity, CityWithRelationsEntity } from './entities/city.entity';
import { CreateCityDto } from './dto/create-city.dto';

export const CITY_FILTER_FIELDS = ['countryId', 'stateId', 'createdAt', 'updatedAt'];
export const CITY_DATE_FIELDS = ['createdAt', 'updatedAt'];
export const CITY_NUMBER_FIELDS = ['countryId', 'stateId'];
export const CITY_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'];
export const CITY_SEARCHABLE_FIELDS = ['name'];

@Injectable()
export class CityService {
  constructor(
    private readonly cityRepository: CityRepository,
    private readonly countryRepository: CountryRepository,
    private readonly stateRepository: StateRepository,
  ) {}

  private validationError(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message }],
    });
  }

  async list(query: ListQueryDto): Promise<{ items: CityEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, CITY_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.CityWhereInput>(query.filter, CITY_FILTER_FIELDS, {
      dateFields: CITY_DATE_FIELDS,
      numberFields: CITY_NUMBER_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.CityWhereInput>(query.search, CITY_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.CityWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.cityRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.CityOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  findById(id: number): Promise<CityWithRelationsEntity> {
    return this.cityRepository.findById(id);
  }

  // Inline-create city (trust boundary): validasi country → state → idempoten.
  async create(dto: CreateCityDto): Promise<CityEntity> {
    const country = await this.countryRepository.findByIdOrNull(dto.countryId);
    if (!country) throw this.validationError('countryId', 'countryId does not exist');

    if (dto.stateId != null) {
      const state = await this.stateRepository.findByIdOrNull(dto.stateId);
      if (!state || state.countryId !== dto.countryId) {
        throw this.validationError('stateId', 'stateId must belong to countryId');
      }
    }

    return this.cityRepository.createIdempotent({
      name: dto.name,
      countryId: dto.countryId,
      stateId: dto.stateId ?? null,
    });
  }
}
