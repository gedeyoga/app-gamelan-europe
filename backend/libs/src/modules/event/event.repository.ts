import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, ContentVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { eventSelect, EventEntity, mapEvent } from './entities/event.entity';

export interface EventLocationData {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface EventDateData {
  date: Date;
  startTime?: string;
  endTime?: string;
}

export interface CreateEventData {
  name: string;
  slug: string;
  content: string;
  thumbnail?: string;
  status?: ContentStatus;
  visibility: ContentVisibility;
  publishedAt?: Date;
  approvedAt?: Date;
  createdBy?: string;
  organizationId?: string;
  eventTypeIds?: string[];
  dates?: EventDateData[];
  location: EventLocationData;
}

export interface UpdateEventData {
  name?: string;
  slug?: string;
  content?: string;
  thumbnail?: string | null;
  status?: ContentStatus;
  visibility?: ContentVisibility;
  publishedAt?: Date;
  approvedAt?: Date;
  organizationId?: string | null;
  eventTypeIds?: string[];
  dates?: EventDateData[];
  location?: EventLocationData;
}

@Injectable()
export class EventRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient | PrismaService {
    return tx ?? this.prisma;
  }

  private mapUnique(e: unknown): void {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('Slug already exists');
    }
  }

  // Replace-all: hapus relasi lama lalu buat dari payload (satu transaksi).
  private async setEventTypes(
    tx: Prisma.TransactionClient,
    eventId: string,
    eventTypeIds: string[],
  ): Promise<void> {
    await tx.assignEventType.deleteMany({ where: { eventId } });
    if (eventTypeIds.length > 0) {
      await tx.assignEventType.createMany({
        data: eventTypeIds.map((eventTypeId) => ({ eventId, eventTypeId })),
        skipDuplicates: true,
      });
    }
  }

  private async setDates(tx: Prisma.TransactionClient, eventId: string, dates: EventDateData[]): Promise<void> {
    await tx.eventDate.deleteMany({ where: { eventId } });
    if (dates.length > 0) {
      await tx.eventDate.createMany({
        data: dates.map(({ date, startTime, endTime }) => ({ eventId, date, startTime, endTime })),
      });
    }
  }

  private async setLocation(
    tx: Prisma.TransactionClient,
    eventId: string,
    location: EventLocationData,
  ): Promise<void> {
    await tx.eventLocation.deleteMany({ where: { eventId } });
    await tx.eventLocation.create({
      data: { eventId, name: location.name, address: location.address, lat: location.lat, lng: location.lng },
    });
  }

  async findById(id: string): Promise<EventEntity> {
    const event = await this.prisma.event.findUnique({ where: { id }, select: eventSelect });
    if (!event) throw new NotFoundException('Event not found');
    return mapEvent(event);
  }

  async existsBySlug(slug: string, tx?: Prisma.TransactionClient): Promise<boolean> {
    const found = await this.client(tx).event.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(found);
  }

  async findMany(params: {
    where: Prisma.EventWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.EventOrderByWithRelationInput;
  }): Promise<{ items: EventEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({ ...params, select: eventSelect }),
      this.prisma.event.count({ where: params.where }),
    ]);
    return { items: items.map(mapEvent), total };
  }

  private async createWith(tx: Prisma.TransactionClient, data: CreateEventData): Promise<EventEntity> {
    const event = await tx.event.create({
      data: {
        name: data.name,
        slug: data.slug,
        content: data.content,
        thumbnail: data.thumbnail,
        status: data.status,
        visibility: data.visibility,
        publishedAt: data.publishedAt,
        approvedAt: data.approvedAt,
        createdBy: data.createdBy,
        organizationId: data.organizationId,
      },
      select: { id: true },
    });
    if (data.eventTypeIds !== undefined) await this.setEventTypes(tx, event.id, data.eventTypeIds);
    if (data.dates !== undefined) await this.setDates(tx, event.id, data.dates);
    await this.setLocation(tx, event.id, data.location);
    return mapEvent(await tx.event.findUniqueOrThrow({ where: { id: event.id }, select: eventSelect }));
  }

  async create(data: CreateEventData): Promise<EventEntity> {
    try {
      return await this.prisma.$transaction((tx) => this.createWith(tx, data));
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // Dipakai lintas modul (event-submission approve) di dalam transaksi milik caller.
  // P2002 TIDAK dimap di sini agar caller bisa retry slug tanpa tx aborted.
  async createInTransaction(tx: Prisma.TransactionClient, data: CreateEventData): Promise<EventEntity> {
    return this.createWith(tx, data);
  }

  // Update status atomik (conditional). true = tepat 1 row berubah → guard anti-TOCTOU.
  // `from` boleh array (mis. `publish` dari DRAFT atau APPROVED legacy).
  async updateStatusIf(
    id: string,
    from: ContentStatus | ContentStatus[],
    to: ContentStatus,
    extra: { approvedAt?: Date; publishedAt?: Date } = {},
  ): Promise<boolean> {
    const statuses = Array.isArray(from) ? from : [from];
    const res = await this.prisma.event.updateMany({
      where: { id, status: { in: statuses } },
      data: { status: to, ...extra },
    });
    return res.count === 1;
  }

  async update(id: string, data: UpdateEventData): Promise<EventEntity> {
    const existing = await this.prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Event not found');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const update: Prisma.EventUpdateInput = {};
        if (data.name !== undefined) update.name = data.name;
        if (data.slug !== undefined) update.slug = data.slug;
        if (data.content !== undefined) update.content = data.content;
        if (data.thumbnail !== undefined) update.thumbnail = data.thumbnail;
        if (data.status !== undefined) update.status = data.status;
        if (data.visibility !== undefined) update.visibility = data.visibility;
        if (data.publishedAt !== undefined) update.publishedAt = data.publishedAt;
        if (data.approvedAt !== undefined) update.approvedAt = data.approvedAt;
        if (data.organizationId !== undefined) update.organization = data.organizationId ? { connect: { id: data.organizationId } } : { disconnect: true };
        if (Object.keys(update).length > 0) {
          await tx.event.update({ where: { id }, data: update });
        }
        if (data.eventTypeIds !== undefined) await this.setEventTypes(tx, id, data.eventTypeIds);
        if (data.dates !== undefined) await this.setDates(tx, id, data.dates);
        if (data.location !== undefined) await this.setLocation(tx, id, data.location);
        return mapEvent(await tx.event.findUniqueOrThrow({ where: { id }, select: eventSelect }));
      });
    } catch (e) {
      this.mapUnique(e);
      throw e;
    }
  }

  // `event_dates` / `assign_event_types` / `event_locations` ikut terhapus via FK onDelete: Cascade.
  async delete(id: string): Promise<EventEntity> {
    const event = await this.prisma.event.findUnique({ where: { id }, select: eventSelect });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.event.delete({ where: { id } });
    return mapEvent(event);
  }
}
