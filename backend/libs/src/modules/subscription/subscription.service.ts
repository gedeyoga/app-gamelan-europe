import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
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
export const SUBSCRIPTION_SORT_FIELDS = [
  'name',
  'slug',
  'subscriptionType',
  'status',
  'currency',
  'price',
  'durationInDays',
  'createdAt',
  'updatedAt',
];
export const SUBSCRIPTION_FILTER_FIELDS = [
  'name',
  'slug',
  'subscriptionType',
  'status',
  'currency',
  'durationInDays',
  'createdAt',
  'updatedAt',
];
export const SUBSCRIPTION_NUMBER_FIELDS = ['durationInDays'];
export const SUBSCRIPTION_DATE_FIELDS = ['createdAt', 'updatedAt'];

@Injectable()
export class SubscriptionService {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  async list(query: ListQueryDto): Promise<{ items: SubscriptionEntity[]; total: number }> {
    return this.runList(query);
  }

  // Katalog user login: sama dengan `list()` tetapi `status` DIPAKSA ACTIVE.
  async listAvailable(query: ListQueryDto): Promise<{ items: SubscriptionEntity[]; total: number }> {
    return this.runList(query, 'ACTIVE');
  }

  private async runList(
    query: ListQueryDto,
    forcedStatus?: SubscriptionStatus,
  ): Promise<{ items: SubscriptionEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, SUBSCRIPTION_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.SubscriptionWhereInput>(query.filter, SUBSCRIPTION_FILTER_FIELDS, {
      enumFields: { subscriptionType: ['MONTHLY', 'YEARLY'], status: ['ACTIVE', 'INACTIVE'] },
      dateFields: SUBSCRIPTION_DATE_FIELDS,
      numberFields: SUBSCRIPTION_NUMBER_FIELDS,
    });
    // Paket INACTIVE tidak boleh ditawarkan: timpa filter[status] user bila ada.
    if (forcedStatus) filterWhere.status = forcedStatus;
    const searchWhere = buildSearch<Prisma.SubscriptionWhereInput>(query.search, SUBSCRIPTION_SEARCHABLE_FIELDS);
    // Soft-delete: baris terhapus TIDAK pernah tampil di list.
    const where = combineWhere<Prisma.SubscriptionWhereInput>(
      { deletedAt: null, ...filterWhere } as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    const result = await this.subscriptionRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.SubscriptionOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
    return { items: await this.attachCounts(result.items), total: result.total };
  }

  // Billing query hanya di repository; service menempelkan hasilnya ke entity.
  private async attachCounts(items: SubscriptionEntity[]): Promise<SubscriptionEntity[]> {
    if (items.length === 0) return items;
    const counts = await this.subscriptionRepository.countSubscribers(items.map((item) => item.id));
    return items.map((item) => ({ ...item, subscriberCount: counts.get(item.id) ?? 0 }));
  }

  private async attachCount(item: SubscriptionEntity): Promise<SubscriptionEntity> {
    return (await this.attachCounts([item]))[0];
  }

  // Self-service: paket aktif milik user (null bila tidak ada billing non-CANCELED).
  async findMine(userId: string): Promise<SubscriptionEntity | null> {
    const subscription = await this.subscriptionRepository.findMineByUser(userId);
    return subscription ? this.attachCount(subscription) : null;
  }

  async findOne(id: string): Promise<SubscriptionEntity> {
    return this.attachCount(await this.subscriptionRepository.findById(id));
  }

  create(dto: CreateSubscriptionDto): Promise<SubscriptionEntity> {
    // Subscription baru belum punya Billing → subscriberCount = 0 tanpa query.
    return this.subscriptionRepository.create({
      name: dto.name,
      slug: dto.slug,
      subscriptionType: dto.subscriptionType,
      status: dto.status ?? 'ACTIVE',
      currency: dto.currency,
      price: dto.price,
      durationInDays: dto.durationInDays,
    });
  }

  async update(id: string, dto: UpdateSubscriptionDto): Promise<SubscriptionEntity> {
    const data: Prisma.SubscriptionUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.subscriptionType !== undefined) data.subscriptionType = dto.subscriptionType;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.durationInDays !== undefined) data.durationInDays = dto.durationInDays;
    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }
    return this.attachCount(await this.subscriptionRepository.update(id, data));
  }

  async remove(id: string): Promise<SubscriptionEntity> {
    return this.attachCount(await this.subscriptionRepository.remove(id));
  }
}
