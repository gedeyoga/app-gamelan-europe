import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { EventTypeRepository } from './event-type.repository';
import { EventTypeEntity } from './entities/event-type.entity';
import { CreateEventTypeDto } from './dto/create-event-type.dto';

export const EVENT_TYPE_SEARCHABLE_FIELDS = ['name'];
export const EVENT_TYPE_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'];
export const EVENT_TYPE_FILTER_FIELDS = ['name', 'createdAt', 'updatedAt'];
export const EVENT_TYPE_DATE_FIELDS = ['createdAt', 'updatedAt'];

@Injectable()
export class EventTypeService {
  constructor(private readonly eventTypeRepository: EventTypeRepository) {}

  async list(query: ListQueryDto): Promise<{ items: EventTypeEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, EVENT_TYPE_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.EventTypeWhereInput>(query.filter, EVENT_TYPE_FILTER_FIELDS, {
      dateFields: EVENT_TYPE_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.EventTypeWhereInput>(query.search, EVENT_TYPE_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.EventTypeWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.eventTypeRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.EventTypeOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  create(dto: CreateEventTypeDto): Promise<EventTypeEntity> {
    return this.eventTypeRepository.createIdempotent({ name: dto.name });
  }
}
