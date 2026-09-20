import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildWhere,
  assertAllowedSort,
  buildSearch,
  combineWhere,
  buildOrderBy,
} from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionEntity } from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

export const SUBSCRIPTION_SEARCHABLE_FIELDS = ['name', 'slug', 'currency'];
export const SUBSCRIPTION_SORT_FIELDS = ['name', 'slug', 'subscriptionType', 'currency', 'createdAt', 'updatedAt'];
export const SUBSCRIPTION_FILTER_FIELDS = ['name', 'slug', 'subscriptionType', 'currency', 'createdAt', 'updatedAt'];
export const SUBSCRIPTION_DATE_FIELDS = ['createdAt', 'updatedAt'];

@Injectable()
export class SubscriptionService {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  async list(query: ListQueryDto): Promise<{ items: SubscriptionEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, SUBSCRIPTION_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.SubscriptionWhereInput>(query.filter, SUBSCRIPTION_FILTER_FIELDS, {
      enumFields: { subscriptionType: ['MONTHLY', 'YEARLY'] },
      dateFields: SUBSCRIPTION_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.SubscriptionWhereInput>(query.search, SUBSCRIPTION_SEARCHABLE_FIELDS);
    // Soft-delete: baris terhapus TIDAK pernah tampil di list.
    const where = combineWhere<Prisma.SubscriptionWhereInput>(
      { deletedAt: null, ...filterWhere } as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.subscriptionRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.SubscriptionOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  // Self-service: paket aktif milik user (null bila tidak ada billing non-CANCELED).
  findMine(userId: string): Promise<SubscriptionEntity | null> {
    return this.subscriptionRepository.findMineByUser(userId);
  }

  findOne(id: string): Promise<SubscriptionEntity> {
    return this.subscriptionRepository.findById(id);
  }

  create(dto: CreateSubscriptionDto): Promise<SubscriptionEntity> {
    return this.subscriptionRepository.create({
      name: dto.name,
      slug: dto.slug,
      subscriptionType: dto.subscriptionType,
      currency: dto.currency,
    });
  }

  update(id: string, dto: UpdateSubscriptionDto): Promise<SubscriptionEntity> {
    const data: Prisma.SubscriptionUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.subscriptionType !== undefined) data.subscriptionType = dto.subscriptionType;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }
    return this.subscriptionRepository.update(id, data);
  }

  remove(id: string): Promise<SubscriptionEntity> {
    return this.subscriptionRepository.remove(id);
  }
}
