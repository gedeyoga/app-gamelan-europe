import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { eventTypeSelect, EventTypeEntity } from './entities/event-type.entity';

@Injectable()
export class EventTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: {
    where: Prisma.EventTypeWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.EventTypeOrderByWithRelationInput;
  }): Promise<{ items: EventTypeEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eventType.findMany({ ...params, select: eventTypeSelect }),
      this.prisma.eventType.count({ where: params.where }),
    ]);
    return { items, total };
  }

  // Inline-add tipe event: name sama (case-insensitive) → kembalikan existing (bukan 409).
  async createIdempotent(data: { name: string }): Promise<EventTypeEntity> {
    const existing = await this.prisma.eventType.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' } },
      select: eventTypeSelect,
    });
    if (existing) return existing;
    return this.prisma.eventType.create({ data, select: eventTypeSelect });
  }
}
