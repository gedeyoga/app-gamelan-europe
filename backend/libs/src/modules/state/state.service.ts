import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { CountryRepository } from '@app/libs/modules/country/country.repository';
import { StateRepository } from './state.repository';
import { StateEntity, StateWithCountryEntity } from './entities/state.entity';
import { CreateStateDto } from './dto/create-state.dto';

export const STATE_FILTER_FIELDS = ['countryId', 'countryCode', 'type', 'level', 'createdAt', 'updatedAt'];
export const STATE_DATE_FIELDS = ['createdAt', 'updatedAt'];
export const STATE_NUMBER_FIELDS = ['countryId', 'level'];
// Semua kolom yang ditampilkan di menu States wajib sortable.
export const STATE_SORT_FIELDS = ['name', 'countryCode', 'type', 'level', 'createdAt', 'updatedAt'];
// Global search bar menu States: OR like ke kolom-kolom ini.
export const STATE_SEARCHABLE_FIELDS = ['name', 'native'];

@Injectable()
export class StateService {
  constructor(private readonly stateRepository: StateRepository, private readonly countryRepository: CountryRepository) {}

  private validationError(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message }],
    });
  }

  async list(query: ListQueryDto): Promise<{ items: StateEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, STATE_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.StateWhereInput>(query.filter, STATE_FILTER_FIELDS, {
      dateFields: STATE_DATE_FIELDS,
      numberFields: STATE_NUMBER_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.StateWhereInput>(query.search, STATE_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.StateWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.stateRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.StateOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  findById(id: number): Promise<StateWithCountryEntity> {
    return this.stateRepository.findById(id);
  }

  // Inline-create state (trust boundary): validasi country → idempoten.
  async create(dto: CreateStateDto): Promise<StateEntity> {
    const country = await this.countryRepository.findByIdOrNull(dto.countryId);
    if (!country) throw this.validationError('countryId', 'countryId does not exist');

    return this.stateRepository.createIdempotent({
      name: dto.name,
      countryId: dto.countryId,
      countryCode: country.iso2,
    });
  }
}
