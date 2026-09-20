import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { BillingEntity, billingSelect, mapBilling } from './entities/billing.entity';

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapUnique(e: unknown): void {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Billing code already exists');
    }
  }

  async findById(id: string): Promise<BillingEntity> {
    const billing = await this.prisma.billing.findUnique({ where: { id }, select: billingSelect });
    if (!billing) throw new NotFoundException('Billing not found');
    return mapBilling(billing);
  }

  async findMany(params: {
    where: Prisma.BillingWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.BillingOrderByWithRelationInput;
  }): Promise<{ items: BillingEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.billing.findMany({ ...params, select: billingSelect }),
      this.prisma.billing.count({ where: params.where }),
    ]);
    return { items: items.map(mapBilling), total };
  }

  // Nested create lines (`lines: { create: [...] }`) ditangani Prisma secara atomik.
  async create(data: Prisma.BillingCreateInput): Promise<BillingEntity> {
    try {
      return mapBilling(await this.prisma.billing.create({ data, select: billingSelect }));
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // `lines === undefined` → lines lama tetap. `lines` array (boleh kosong) → REPLACE seluruh lines.
  async update(
    id: string,
    data: Prisma.BillingUpdateInput,
    lines?: Prisma.BillingLineCreateManyBillingInput[],
  ): Promise<BillingEntity> {
    const existing = await this.prisma.billing.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Billing not found');
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.billing.update({ where: { id }, data });
        }
        if (lines !== undefined) {
          await tx.billingLine.deleteMany({ where: { billingId: id } });
          if (lines.length > 0) {
            await tx.billingLine.createMany({ data: lines.map((line) => ({ ...line, billingId: id })) });
          }
        }
        return mapBilling(await tx.billing.findUniqueOrThrow({ where: { id }, select: billingSelect }));
      });
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // `billing_lines` ikut terhapus via FK `onDelete: Cascade`.
  async remove(id: string): Promise<BillingEntity> {
    const existing = await this.prisma.billing.findUnique({ where: { id }, select: billingSelect });
    if (!existing) throw new NotFoundException('Billing not found');
    await this.prisma.billing.delete({ where: { id } });
    return mapBilling(existing);
  }
}
