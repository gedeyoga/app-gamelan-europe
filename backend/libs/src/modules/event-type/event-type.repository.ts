import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { eventTypeSelect, EventTypeEntity } from './entities/event-type.entity';

@Injectable()
export class EventTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Non-throwing lookup (validasi body trust boundary).
  async findByIdOrNull(id: string): Promise<EventTypeEntity | null> {
    return this.prisma.eventType.findUnique({ where: { id }, select: eventTypeSelect });
  }

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

  async remove(id: string): Promise<EventTypeEntity> {
    const existing = await this.prisma.eventType.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Event type not found');
    return this.prisma.eventType.delete({ where: { id }, select: eventTypeSelect });
  }
}
