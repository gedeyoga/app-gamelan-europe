import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ContentStatus, ContentVisibility, Prisma } from '@prisma/client';
import { AccessScope, AccessScopeService } from '@app/libs/core/auth/access-scope.service';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { EventRepository, CreateEventData, UpdateEventData } from './event.repository';
import { EventEntity, EventResponse } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { slugify } from './utils/slug.util';

export const EVENT_SEARCHABLE_FIELDS = ['name', 'slug'];
export const EVENT_SORT_FIELDS = ['name', 'slug', 'status', 'visibility', 'publishedAt', 'createdAt', 'updatedAt'];
export const EVENT_FILTER_FIELDS = ['status', 'publishedAt', 'createdAt', 'updatedAt'];
export const EVENT_DATE_FIELDS = ['publishedAt', 'createdAt', 'updatedAt'];

export type EventAction = 'submit' | 'approve' | 'reject' | 'publish' | 'unpublish';

// Sumber tunggal aturan transisi status event. Pure & mudah diaudit.
export const EVENT_TRANSITIONS: Record<EventAction, { from: ContentStatus; to: ContentStatus }> = {
  submit: { from: ContentStatus.DRAFT, to: ContentStatus.REQUEST },
  approve: { from: ContentStatus.REQUEST, to: ContentStatus.APPROVED },
  reject: { from: ContentStatus.REQUEST, to: ContentStatus.DRAFT },
  publish: { from: ContentStatus.APPROVED, to: ContentStatus.PUBLISHED },
  unpublish: { from: ContentStatus.PUBLISHED, to: ContentStatus.DRAFT },
};

@Injectable()
export class EventService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly accessScope: AccessScopeService,
  ) {}

  // Scope baca. `none` tidak pernah sampai sini (list early-return); dikembalikan kosong agar aman.
  private scopeWhere(scope: AccessScope): Prisma.EventWhereInput | undefined {
    switch (scope.kind) {
      case 'all':
        return undefined;
      case 'organization':
        return { creator: { organizationId: scope.organizationId } };
      case 'published': {
        // Terbit berdasarkan `publishedAt`: PUBLISHED + publishedAt terisi + <= sekarang (scheduled future tersembunyi).
        const base: Prisma.EventWhereInput = {
          status: ContentStatus.PUBLISHED,
          publishedAt: { not: null, lte: new Date() },
        };
        return scope.canViewPrivate ? base : { ...base, visibility: ContentVisibility.PUBLIC };
      }
      case 'none':
        return { id: { in: [] } };
    }
  }

  // Baca: org hanya konten organisasinya; published hanya status PUBLISHED; none tolak.
  private assertReadable(event: EventEntity, scope: AccessScope): void {
    if (scope.kind === 'none') throw new ForbiddenException('Forbidden resource');
    if (event.visibility === ContentVisibility.PRIVATE && !scope.canViewPrivate) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (scope.kind === 'organization' && event.creator?.organizationId !== scope.organizationId) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (scope.kind === 'published') {
      // Sudah terbit: PUBLISHED + publishedAt terisi + <= sekarang (scheduled future → 403).
      if (
        event.status !== ContentStatus.PUBLISHED ||
        !event.publishedAt ||
        event.publishedAt.getTime() > Date.now()
      ) {
        throw new ForbiddenException('Forbidden resource');
      }
    }
  }

  // Tulis: admin bebas; organization hanya konten organisasinya; none/published tolak (defensif,
  // guard permission biasanya sudah memblok lebih dulu).
  private assertWritable(event: EventEntity, scope: AccessScope): void {
    if (scope.kind === 'organization') {
      if (event.creator?.organizationId !== scope.organizationId) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
    }
    if (scope.kind !== 'all') throw new ForbiddenException('Forbidden resource');
  }

  // Buang `creator.organizationId` (tenancy internal) dari response; sertakan `organization` { id, name }.
  private toResponse(event: EventEntity): EventResponse {
    const { creator, ...rest } = event;
    return {
      ...rest,
      creator: creator
        ? {
            id: creator.id,
            fullName: creator.fullName,
            organization: creator.organization
              ? { id: creator.organization.id, name: creator.organization.name }
              : null,
          }
        : null,
    };
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 2; await this.eventRepository.existsBySlug(slug); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }

  async list(query: ListQueryDto, userId: string): Promise<{ items: EventResponse[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, EVENT_SORT_FIELDS);
    const scope = await this.accessScope.resolve(userId);
    if (scope.kind === 'none') return { items: [], total: 0 };
    const filterWhere = buildWhere<Prisma.EventWhereInput>(query.filter, EVENT_FILTER_FIELDS, {
      enumFields: { status: ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] },
      dateFields: EVENT_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.EventWhereInput>(query.search, EVENT_SEARCHABLE_FIELDS);
    const sw = this.scopeWhere(scope);
    const scopedFilter = sw ? { AND: [sw, filterWhere] } : (filterWhere as unknown as Record<string, unknown>);
    const where = combineWhere<Prisma.EventWhereInput>(
      scopedFilter as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    const { items, total } = await this.eventRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.EventOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
    return { items: items.map((event) => this.toResponse(event)), total };
  }

  async findOne(id: string, userId: string): Promise<EventResponse> {
    const [event, scope] = await Promise.all([
      this.eventRepository.findById(id),
      this.accessScope.resolve(userId),
    ]);
    this.assertReadable(event, scope); // cek scope pakai entity mentah (punya organizationId)
    return this.toResponse(event);
  }

  private buildCreateData(dto: CreateEventDto, slug: string, status: ContentStatus, createdBy?: string): CreateEventData {
    const now = new Date();
    // Tanggal publish manual → pakai tanggal user + paksa PUBLISHED. Tanpa itu, perilaku lama.
    const autoPublish = dto.publishedAt !== undefined;
    return {
      name: dto.name,
      slug,
      content: dto.content ?? '',
      thumbnail: dto.thumbnail,
      status: autoPublish ? ContentStatus.PUBLISHED : status,
      visibility: dto.visibility ?? ContentVisibility.PUBLIC,
      createdBy,
      publishedAt: autoPublish
        ? new Date(dto.publishedAt!)
        : status === ContentStatus.PUBLISHED
          ? now
          : undefined,
      approvedAt: status === ContentStatus.APPROVED ? now : undefined,
      eventTypeIds: dto.eventTypeIds,
      dates: dto.dates?.map((d) => ({ date: new Date(d.date), startTime: d.startTime, endTime: d.endTime })),
      location: dto.location,
    };
  }

  async create(dto: CreateEventDto, userId: string): Promise<EventResponse> {
    const scope = await this.accessScope.resolve(userId);
    if (scope.kind !== 'all' && scope.kind !== 'organization') {
      throw new ForbiddenException('Forbidden resource');
    }
    // Non-admin tidak boleh memaksa status/publishedAt (tutup bypass workflow).
    const scoped = scope.kind === 'all' ? dto : { ...dto, status: ContentStatus.DRAFT, publishedAt: undefined };
    const status = scoped.status ?? ContentStatus.DRAFT;

    // Slug eksplisit: bentrok → 409 apa adanya (tanpa retry).
    if (scoped.slug) {
      return this.toResponse(await this.eventRepository.create(this.buildCreateData(scoped, scoped.slug, status, userId)));
    }

    // Slug auto: retry singkat bila kalah race cek-lalu-insert (P2002 → ConflictException).
    const base = slugify(scoped.name);
    let slug = await this.uniqueSlug(base);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return this.toResponse(await this.eventRepository.create(this.buildCreateData(scoped, slug, status, userId)));
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        slug = await this.uniqueSlug(base);
      }
    }
    throw new ConflictException('Slug already exists');
  }

  async update(id: string, dto: UpdateEventDto, userId: string): Promise<EventResponse> {
    const existing = await this.eventRepository.findById(id);
    const scope = await this.accessScope.resolve(userId);
    this.assertWritable(existing, scope);
    const data: UpdateEventData = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.thumbnail !== undefined) data.thumbnail = dto.thumbnail;
    if (dto.eventTypeIds !== undefined) data.eventTypeIds = dto.eventTypeIds;
    if (dto.dates !== undefined)
      data.dates = dto.dates.map((d) => ({ date: new Date(d.date), startTime: d.startTime, endTime: d.endTime }));
    if (dto.location !== undefined) data.location = dto.location;
    // Visibility boleh diubah scope `all` maupun `organization` (assertWritable sudah membatasi).
    if (dto.visibility !== undefined) data.visibility = dto.visibility;

    // Scope != all: status/publishedAt dari body diabaikan (tutup bypass workflow).
    if (scope.kind === 'all') {
      if (dto.publishedAt !== undefined) {
        // Tanggal publish manual: timpa nilai lama (ubah/backdate) + paksa PUBLISHED.
        data.publishedAt = new Date(dto.publishedAt);
        data.status = ContentStatus.PUBLISHED;
      } else if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === ContentStatus.PUBLISHED && !existing.publishedAt) data.publishedAt = new Date();
        if (dto.status === ContentStatus.APPROVED && !existing.approvedAt) data.approvedAt = new Date();
      }
    }

    return this.toResponse(await this.eventRepository.update(id, data));
  }

  // Transisi status terkontrol; `PATCH /events/:id` tetap untuk update konten.
  async transition(id: string, action: EventAction, userId: string): Promise<EventResponse> {
    const existing = await this.eventRepository.findById(id); // 404 bila tak ada
    const scope = await this.accessScope.resolve(userId);
    this.assertWritable(existing, scope);
    const rule = EVENT_TRANSITIONS[action];
    if (existing.status !== rule.from) {
      throw new ConflictException(`Cannot ${action} event in status ${existing.status}`);
    }
    // `updateStatusIf` conditional → dua request paralel dari status sama: hanya satu sukses.
    const extra: { approvedAt?: Date; publishedAt?: Date } = {};
    if (action === 'approve' && !existing.approvedAt) extra.approvedAt = new Date();
    if (action === 'publish' && !existing.publishedAt) extra.publishedAt = new Date();
    const updated = await this.eventRepository.updateStatusIf(id, rule.from, rule.to, extra);
    if (!updated) {
      const current = await this.eventRepository.findById(id); // 404 bila event terhapus
      throw new ConflictException(`Cannot ${action} event in status ${current.status}`);
    }
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<EventResponse> {
    const existing = await this.eventRepository.findById(id);
    const scope = await this.accessScope.resolve(userId);
    this.assertWritable(existing, scope);
    return this.toResponse(await this.eventRepository.delete(id));
  }
}
