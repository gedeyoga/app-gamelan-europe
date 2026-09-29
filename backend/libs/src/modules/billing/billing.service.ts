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
import { BillingRepository } from './billing.repository';
import { BillingEntity } from './entities/billing.entity';
import { CreateBillingDto } from './dto/create-billing.dto';
import { UpdateBillingDto } from './dto/update-billing.dto';
import { BillingLineDto } from './dto/billing-line.dto';

export const BILLING_SEARCHABLE_FIELDS = ['code', 'currency'];
export const BILLING_SORT_FIELDS = [
  'code',
  'status',
  'subscriptionType',
  'currency',
  'total',
  'paidAt',
  'canceledAt',
  'createdAt',
  'updatedAt',
  'user.fullName',
  'subscription.name',
];
export const BILLING_FILTER_FIELDS = [
  'code',
  'status',
  'subscriptionType',
  'currency',
  'userId',
  'networkId',
  'subscriptionId',
  'paidAt',
  'canceledAt',
  'createdAt',
  'updatedAt',
];
export const BILLING_DATE_FIELDS = ['paidAt', 'canceledAt', 'createdAt', 'updatedAt'];

// sortBy kolom relasi → path nested Prisma (satu level).
export const BILLING_SORT_MAP: Record<string, string> = {
  'user.fullName': 'user.fullName',
  'subscription.name': 'subscription.name',
};

@Injectable()
export class BillingService {
  constructor(private readonly billingRepository: BillingRepository) {}

  private toLineData(line: BillingLineDto): Prisma.BillingLineCreateManyBillingInput {
    return {
      description: line.description,
      type: line.type,
      amount: line.amount,
      currency: line.currency,
      ...(line.qty !== undefined ? { qty: line.qty } : {}),
    };
  }

  async list(query: ListQueryDto): Promise<{ items: BillingEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, BILLING_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.BillingWhereInput>(query.filter, BILLING_FILTER_FIELDS, {
      enumFields: {
        status: ['PENDING', 'PAID', 'CANCELED'],
        subscriptionType: ['MONTHLY', 'YEARLY'],
      },
      dateFields: BILLING_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.BillingWhereInput>(query.search, BILLING_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.BillingWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.billingRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.BillingOrderByWithRelationInput>(query.sortBy, query.sortOrder, BILLING_SORT_MAP),
    });
  }

  // Self-service: scoping dikunci ke user pemanggil; filter[userId] dari klien ditimpa.
  findMine(userId: string, query: ListQueryDto): Promise<{ items: BillingEntity[]; total: number }> {
    return this.list({ ...query, filter: { ...(query.filter ?? {}), userId } });
  }

  findOne(id: string): Promise<BillingEntity> {
    return this.billingRepository.findById(id);
  }

  create(dto: CreateBillingDto): Promise<BillingEntity> {
    const data: Prisma.BillingCreateInput = {
      user: { connect: { id: dto.userId } },
      subscription: { connect: { id: dto.subscriptionId } },
      code: dto.code,
      subscriptionType: dto.subscriptionType,
      currency: dto.currency,
      total: dto.total,
      lines: { create: dto.lines.map((line) => this.toLineData(line)) },
    };
    if (dto.networkId !== undefined && dto.networkId !== null) {
      data.network = { connect: { id: dto.networkId } };
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.discount !== undefined) data.discount = dto.discount;
    if (dto.tax !== undefined) data.tax = dto.tax;
    if (dto.paidAt !== undefined) data.paidAt = dto.paidAt === null ? null : new Date(dto.paidAt);
    if (dto.canceledAt !== undefined) data.canceledAt = dto.canceledAt === null ? null : new Date(dto.canceledAt);
    return this.billingRepository.create(data);
  }

  update(id: string, dto: UpdateBillingDto): Promise<BillingEntity> {
    const data: Prisma.BillingUpdateInput = {};
    if (dto.userId !== undefined) data.user = { connect: { id: dto.userId } };
    if (dto.networkId !== undefined) {
      data.network =
        dto.networkId === null ? { disconnect: true } : { connect: { id: dto.networkId } };
    }
    if (dto.subscriptionId !== undefined) data.subscription = { connect: { id: dto.subscriptionId } };
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.subscriptionType !== undefined) data.subscriptionType = dto.subscriptionType;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.total !== undefined) data.total = dto.total;
    if (dto.discount !== undefined) data.discount = dto.discount;
    if (dto.tax !== undefined) data.tax = dto.tax;
    if (dto.paidAt !== undefined) data.paidAt = dto.paidAt === null ? null : new Date(dto.paidAt);
    if (dto.canceledAt !== undefined) data.canceledAt = dto.canceledAt === null ? null : new Date(dto.canceledAt);

    const lines = dto.lines !== undefined ? dto.lines.map((line) => this.toLineData(line)) : undefined;
    if (Object.keys(data).length === 0 && lines === undefined) {
      return this.findOne(id);
    }
    return this.billingRepository.update(id, data, lines);
  }

  remove(id: string): Promise<BillingEntity> {
    return this.billingRepository.remove(id);
  }
}
