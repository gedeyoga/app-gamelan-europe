import { ConflictException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ContentSource, ContentStatus, ContentVisibility, EventEntry, Prisma } from '@prisma/client';
import { AccessScope, AccessScopeService, ownReadWhere } from '@app/libs/core/auth/access-scope.service';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { escapeHtml } from '@app/libs/common/utils/html.util';
import { CountryRepository } from '@app/libs/modules/country/country.repository';
import { StateRepository } from '@app/libs/modules/state/state.repository';
import { CityRepository } from '@app/libs/modules/city/city.repository';
import { EventTypeRepository } from '@app/libs/modules/event-type/event-type.repository';
import { ImageService } from '@app/libs/modules/image/image.service';
import { NetworkRepository } from '@app/libs/modules/network/network.repository';
import { NetworkService } from '@app/libs/modules/network/network.service';
import { UserRepository } from '@app/libs/modules/user/user.repository';
import { UserService } from '@app/libs/modules/user/user.service';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { EventRepository, CreateEventData, EventLocationData, UpdateEventData } from './event.repository';
import { EventEntity, EventResponse } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { CreatePublicEventDto, MAX_EVENT_RANGE_DAYS } from './dto/create-public-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { slugify } from './utils/slug.util';
import { resolveGoogleMapsLink } from '@app/libs/common/utils/google-maps.util';

export const EVENT_SEARCHABLE_FIELDS = ['name', 'slug'];
export const EVENT_SORT_FIELDS = ['name', 'slug', 'status', 'visibility', 'publishedAt', 'createdAt', 'updatedAt'];
export const EVENT_FILTER_FIELDS = ['status', 'publishedAt', 'createdAt', 'updatedAt'];
export const EVENT_DATE_FIELDS = ['publishedAt', 'createdAt', 'updatedAt'];

export type EventAction = 'submit' | 'approve' | 'reject' | 'publish' | 'unpublish';

// Sumber tunggal aturan transisi status event. Pure & mudah diaudit.
// `from` array: `publish` menerima DRAFT (jalur approve submission) maupun APPROVED (legacy).
export const EVENT_TRANSITIONS: Record<EventAction, { from: ContentStatus[]; to: ContentStatus }> = {
  submit: { from: [ContentStatus.DRAFT], to: ContentStatus.REQUEST },
  approve: { from: [ContentStatus.REQUEST], to: ContentStatus.PUBLISHED },
  reject: { from: [ContentStatus.REQUEST], to: ContentStatus.DRAFT },
  publish: { from: [ContentStatus.DRAFT, ContentStatus.APPROVED], to: ContentStatus.PUBLISHED },
  unpublish: { from: [ContentStatus.PUBLISHED], to: ContentStatus.DRAFT },
};

// "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" → Date UTC midnight (kolom @db.Date).
function toUtcDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Ambil komponen jam "HH:mm" dari ISO lokal `YYYY-MM-DDTHH:mm`; null bila tak ada.
function toTime(iso: string): string | null {
  const m = /[T ](\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : null;
}

// Satu EventDate per hari inklusif; cap `MAX_EVENT_RANGE_DAYS`.
function enumerateDates(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (cursor.getTime() <= last && dates.length < MAX_EVENT_RANGE_DAYS) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

@Injectable()
export class EventService {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly networkRepository: NetworkRepository,
    private readonly networkService: NetworkService,
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
    private readonly countryRepository: CountryRepository,
    private readonly stateRepository: StateRepository,
    private readonly cityRepository: CityRepository,
    private readonly eventTypeRepository: EventTypeRepository,
    private readonly imageService: ImageService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private validationError(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message }],
    });
  }

  // Cek existence Network → 422 per-field (field body trust boundary).
  private async assertNetwork(networkId?: string | null): Promise<void> {
    if (!networkId) return;
    const exists = await this.networkRepository.existsById(networkId);
    if (!exists) {
      throw this.validationError('networkId', 'networkId does not exist');
    }
  }

  // Cek existence setiap authorIds (user) → 422 per-field (cegah P2003 FK saat createMany).
  private async assertAuthors(authorIds?: string[]): Promise<void> {
    if (!authorIds || authorIds.length === 0) return;
    const users = await this.userRepository.findByIds(authorIds);
    const found = new Set(users.map((user) => user.id));
    for (let i = 0; i < authorIds.length; i++) {
      if (!found.has(authorIds[i])) {
        throw this.validationError(`authorIds.${i}`, 'authorId must reference an existing user');
      }
    }
  }

  // Validasi chain geo lokasi (trust boundary): country → state → city.
  // cityId wajib stateId + countryId; stateId wajib countryId; tiap level harus match induknya → 422 per-field.
  private async assertLocationGeo(location: {
    countryId?: number | null;
    stateId?: number | null;
    cityId?: number | null;
  }): Promise<void> {
    const { countryId, stateId, cityId } = location;
    if (countryId != null) {
      const country = await this.countryRepository.findByIdOrNull(countryId);
      if (!country) throw this.validationError('location.countryId', 'countryId does not exist');
    }
    if (stateId != null) {
      if (countryId == null) {
        throw this.validationError('location.stateId', 'stateId requires countryId');
      }
      const state = await this.stateRepository.findByIdOrNull(stateId);
      if (!state || state.countryId !== countryId) {
        throw this.validationError('location.stateId', 'stateId must belong to countryId');
      }
    }
    if (cityId != null) {
      if (stateId == null) {
        throw this.validationError('location.cityId', 'cityId requires stateId');
      }
      const city = await this.cityRepository.findByIdOrNull(cityId);
      if (!city || city.stateId !== stateId) {
        throw this.validationError('location.cityId', 'cityId must belong to stateId');
      }
      if (city.countryId !== countryId) {
        throw this.validationError('location.cityId', 'cityId must belong to countryId');
      }
    }
  }

  // Resolve `mapsUrl` (bila ada) → koordinat + `embedUrl` (server-side). Resolved menimpa lat/lng klien.
  // Tanpa `mapsUrl` → location dibiarkan apa adanya (lat/lng yang dikirim tetap). Gagal resolve → 422.
  private async resolveLocationMaps(location: EventLocationData, field: string): Promise<EventLocationData> {
    if (!location.mapsUrl) return location;
    const resolved = await resolveGoogleMapsLink(location.mapsUrl);
    if (!resolved) {
      throw this.validationError(field, 'mapsUrl must be a Google Maps link with resolvable coordinates');
    }
    return { ...location, lat: resolved.lat, lng: resolved.lng, embedUrl: resolved.embedUrl };
  }

  // Scope baca. `none` tidak pernah sampai sini (list early-return); dikembalikan kosong agar aman.
  private scopeWhere(scope: AccessScope): Prisma.EventWhereInput | undefined {
    switch (scope.kind) {
      case 'all':
        return undefined;
      case 'network':
        return { creator: { networkId: scope.networkId } };
      case 'own':
        return ownReadWhere(scope.userId, scope.canViewPrivate || scope.isMember) as Prisma.EventWhereInput;
      case 'published': {
        // Terbit berdasarkan `publishedAt`: PUBLISHED + publishedAt terisi + <= sekarang (scheduled future tersembunyi).
        const base: Prisma.EventWhereInput = {
          status: ContentStatus.PUBLISHED,
          publishedAt: { not: null, lte: new Date() },
        };
        return scope.canViewPrivate || scope.isMember ? base : { ...base, visibility: ContentVisibility.PUBLIC };
      }
      case 'none':
        return { id: { in: [] } };
    }
  }

  // Filter bulan kalender UTC "YYYY-MM": event dengan minimal satu EventDate.date di
  // [awal bulan, awal bulan berikutnya). `eventMonth` sudah lolos regex DTO.
  private monthWhere(eventMonth?: string): Prisma.EventWhereInput | undefined {
    if (!eventMonth) return undefined;
    const [year, month] = eventMonth.split('-').map(Number);
    return {
      dates: {
        some: {
          date: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lt: new Date(Date.UTC(year, month, 1)),
          },
        },
      },
    };
  }

  // "Upcoming": event dengan minimal satu EventDate.date pada hari ini atau setelahnya (UTC).
  private upcomingWhere(upcoming?: string): Prisma.EventWhereInput | undefined {
    if (upcoming !== 'true') return undefined;
    const now = new Date();
    const startOfUtcDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { dates: { some: { date: { gte: startOfUtcDay } } } };
  }

  // "My Event": organisasi → event satu organisasi; selain itu → event buatan user sendiri.
  // Di-AND dengan scopeWhere (bukan mengganti) supaya scoping tetap aman.
  private mineWhere(scope: AccessScope, userId: string): Prisma.EventWhereInput {
    if (scope.kind === 'network') {
      return { creator: { networkId: scope.networkId } };
    }
    return { createdBy: userId };
  }

  // Relasi: hanya event dengan minimal satu link tipe `eventTypeId` (`eventTypes.some`).
  private eventTypeWhere(eventTypeId?: string): Prisma.EventWhereInput | undefined {
    if (!eventTypeId) return undefined;
    return { eventTypes: { some: { eventTypeId } } };
  }

  // Baca: org hanya konten organisasinya; published hanya status PUBLISHED; none tolak.
  private assertReadable(event: EventEntity, scope: AccessScope): void {
    if (scope.kind === 'none') throw new ForbiddenException('Forbidden resource');
    if (event.visibility === ContentVisibility.PRIVATE && !(scope.canViewPrivate || scope.isMember)) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (scope.kind === 'network' && event.creator?.networkId !== scope.networkId) {
      throw new ForbiddenException('Forbidden resource');
    }
    if (scope.kind === 'own') {
      if (event.createdBy === scope.userId) return; // pemilik bebas
      // Bukan pemilik → baca konten terbit saja (M5).
      if (
        event.status !== ContentStatus.PUBLISHED ||
        !event.publishedAt ||
        event.publishedAt.getTime() > Date.now()
      ) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
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

  // Tulis: admin bebas; network hanya konten network-nya; none/published tolak (defensif,
  // guard permission biasanya sudah memblok lebih dulu).
  private assertWritable(event: EventEntity, scope: AccessScope): void {
    if (scope.kind === 'network') {
      if (event.creator?.networkId !== scope.networkId) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
    }
    if (scope.kind === 'own') {
      if (event.createdBy !== scope.userId) {
        throw new ForbiddenException('Forbidden resource');
      }
      return;
    }
    if (scope.kind !== 'all') throw new ForbiddenException('Forbidden resource');
  }

  // Buang `creator.networkId` (tenancy internal) dari response; sertakan `network` { id, name }.
  private toResponse(event: EventEntity): EventResponse {
    const { creator, ...rest } = event;
    return {
      ...rest,
      creator: creator
        ? {
            id: creator.id,
            fullName: creator.fullName,
            network: creator.network
              ? { id: creator.network.id, name: creator.network.name }
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

  async list(query: ListEventsQueryDto, userId: string): Promise<{ items: EventResponse[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, EVENT_SORT_FIELDS);
    const scope = await this.accessScope.resolve(userId, 'event');
    if (scope.kind === 'none') return { items: [], total: 0 };
    const filterWhere = buildWhere<Prisma.EventWhereInput>(query.filter, EVENT_FILTER_FIELDS, {
      enumFields: { status: ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'] },
      dateFields: EVENT_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.EventWhereInput>(query.search, EVENT_SEARCHABLE_FIELDS);
    // Susun AND: scope + filter + eventMonth + upcoming + mine + eventType, lalu AND dengan search (combineWhere). Bagian kosong dibuang.
    const clauses = [
      this.scopeWhere(scope),
      filterWhere,
      this.monthWhere(query.eventMonth),
      this.upcomingWhere(query.upcoming),
      query.mine === 'true' ? this.mineWhere(scope, userId) : undefined,
      this.eventTypeWhere(query.eventTypeId),
    ].filter((w): w is Prisma.EventWhereInput => !!w && Object.keys(w).length > 0);
    const combined = clauses.length === 1 ? clauses[0] : { AND: clauses };
    const where = combineWhere<Prisma.EventWhereInput>(
      combined as unknown as Record<string, unknown>,
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
      this.accessScope.resolve(userId, 'event'),
    ]);
    this.assertReadable(event, scope); // cek scope pakai entity mentah (punya networkId)
    return this.toResponse(event);
  }

  private buildCreateData(
    dto: CreateEventDto,
    slug: string,
    status: ContentStatus,
    createdBy: string | undefined,
    location: EventLocationData,
  ): CreateEventData {
    const now = new Date();
    // Tanggal publish manual → pakai tanggal user + paksa PUBLISHED. Tanpa itu, perilaku lama.
    const autoPublish = dto.publishedAt !== undefined;
    return {
      name: dto.name,
      slug,
      content: dto.content ?? '',
      thumbnail: dto.thumbnail,
      status: autoPublish ? ContentStatus.PUBLISHED : status,
      source: ContentSource.REGISTERED,
      visibility: dto.visibility ?? ContentVisibility.PUBLIC,
      entry: dto.entry ?? EventEntry.FREE,
      createdBy,
      networkId: dto.networkId ?? undefined,
      publishedAt: autoPublish
        ? new Date(dto.publishedAt!)
        : status === ContentStatus.PUBLISHED
          ? now
          : undefined,
      // Audit marker "pertama kali terbit" (dibuat langsung PUBLISHED), bukan status APPROVED.
      approvedAt: autoPublish || status === ContentStatus.PUBLISHED ? now : undefined,
      eventTypeIds: dto.eventTypeIds,
      dates: dto.dates?.map((d) => ({ date: new Date(d.date), startTime: d.startTime, endTime: d.endTime })),
      location,
      authorIds: dto.authorIds,
    };
  }

  async create(dto: CreateEventDto, userId: string): Promise<EventResponse> {
    const scope = await this.accessScope.resolve(userId, 'event');
    if (scope.kind !== 'all' && scope.kind !== 'network' && scope.kind !== 'own') {
      throw new ForbiddenException('Forbidden resource');
    }
    // Non-admin tidak boleh memaksa status/publishedAt (tutup bypass workflow).
    const scoped = scope.kind === 'all' ? dto : { ...dto, status: ContentStatus.DRAFT, publishedAt: undefined };
    const status = scoped.status ?? ContentStatus.DRAFT;

    await this.assertNetwork(scoped.networkId);
    await this.assertAuthors(scoped.authorIds);
    await this.assertLocationGeo(scoped.location);
    // Resolve mapsUrl lebih awal agar semua jalur slug (eksplisit/auto/retry) memakai koordinat final.
    const location = await this.resolveLocationMaps(scoped.location, 'location.mapsUrl');

    // Slug eksplisit: bentrok → 409 apa adanya (tanpa retry).
    if (scoped.slug) {
      return this.toResponse(
        await this.eventRepository.create(this.buildCreateData(scoped, scoped.slug, status, userId, location)),
      );
    }

    // Slug auto: retry singkat bila kalah race cek-lalu-insert (P2002 → ConflictException).
    const base = slugify(scoped.name);
    let slug = await this.uniqueSlug(base);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return this.toResponse(
          await this.eventRepository.create(this.buildCreateData(scoped, slug, status, userId, location)),
        );
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        slug = await this.uniqueSlug(base);
      }
    }
    throw new ConflictException('Slug already exists');
  }

  // Submit publik (tanpa JWT): tulis langsung `Event` status REQUEST, source PUBLIC.
  // Validasi/kontrak body sama dengan form EGS lama; respons hanya { id, status } (tanpa PII echo).
  // ponytail: window anti-duplikat 10 menit dihapus — throttle 5/60s sudah cukup; tambah lagi bila spam muncul.
  async createPublicSubmission(dto: CreatePublicEventDto): Promise<{ id: string; status: ContentStatus }> {
    const country = await this.countryRepository.findByIdOrNull(dto.countryId);
    if (!country) throw this.validationError('countryId', 'countryId does not exist');
    let state = null;
    if (dto.stateId != null) {
      state = await this.stateRepository.findByIdOrNull(dto.stateId);
      if (!state || state.countryId !== dto.countryId) {
        throw this.validationError('stateId', 'stateId must belong to countryId');
      }
    }
    // cityId opsional: harus ada + milik stateId (bila dikirim) & countryId.
    if (dto.cityId != null) {
      const city = await this.cityRepository.findByIdOrNull(dto.cityId);
      if (!city || city.countryId !== dto.countryId || (dto.stateId != null && city.stateId !== dto.stateId)) {
        throw this.validationError('cityId', 'cityId must belong to countryId/stateId');
      }
    }

    const authorCountry = await this.countryRepository.findByIdOrNull(dto.author.countryId);
    if (!authorCountry) throw this.validationError('author.countryId', 'author.countryId does not exist');
    if (dto.author.stateId != null) {
      const authorState = await this.stateRepository.findByIdOrNull(dto.author.stateId);
      if (!authorState || authorState.countryId !== dto.author.countryId) {
        throw this.validationError('author.stateId', 'author.stateId must belong to author.countryId');
      }
    }

    const eventType = await this.eventTypeRepository.findByIdOrNull(dto.eventTypeId);
    if (!eventType) throw this.validationError('eventTypeId', 'eventTypeId does not exist');

    if (dto.thumbnail) {
      const trusted = await this.imageService.isTrustedUnboundUrl(dto.thumbnail, 'event');
      if (!trusted) {
        throw this.validationError('thumbnail', 'thumbnail must reference an uploaded EGS image');
      }
    }

    // Resolve link Maps SEBELUM membuat User/Network agar link invalid tidak meninggalkan orphan record.
    const maps = dto.mapsUrl
      ? await this.resolveLocationMaps(
          { name: dto.venue || (state?.name ?? country.name), mapsUrl: dto.mapsUrl },
          'mapsUrl',
        )
      : undefined;

    const user = await this.userService.findOrCreatePublicUser({
      fullName: dto.author.fullName,
      email: dto.author.email,
      countryId: authorCountry.iso2,
      stateId: dto.author.stateId ?? null,
    });

    const network = await this.networkService.findOrCreateByName(dto.organiser, {
      state: state?.name ?? null,
      country: country.name,
    });

    const startDate = toUtcDate(dto.startDate);
    const endDate = toUtcDate(dto.endDate);
    const startTime = toTime(dto.startDate);
    const endTime = toTime(dto.endDate);
    const days = enumerateDates(startDate, endDate);
    const base = slugify(dto.title);
    const data: CreateEventData = {
      name: dto.title,
      slug: await this.uniqueSlug(base),
      content: `<p>${escapeHtml(dto.shortDescription)}</p>`,
      thumbnail: dto.thumbnail ?? undefined,
      status: ContentStatus.REQUEST,
      source: ContentSource.PUBLIC,
      visibility: ContentVisibility.PUBLIC,
      entry: dto.entry ?? EventEntry.FREE,
      websiteUrl: dto.websiteUrl ?? null,
      createdBy: user.id,
      networkId: network.id,
      eventTypeIds: [dto.eventTypeId],
      dates: days.map((date) => ({
        date,
        startTime: startTime ?? undefined,
        endTime: endTime ?? undefined,
      })),
      location: {
        // venue/address dikirim → pakai; selain itu fallback derived (state/country).
        name: dto.venue || (state?.name ?? country.name),
        address: dto.address || (state?.name ? `${state.name}, ${country.name}` : country.name),
        countryId: country.id,
        stateId: state?.id ?? null,
        cityId: dto.cityId ?? null,
        mapsUrl: dto.mapsUrl ?? null,
        ...(maps ? { lat: maps.lat, lng: maps.lng, embedUrl: maps.embedUrl } : {}),
      },
      authorIds: [user.id],
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const event = await this.eventRepository.create(data);
        return { id: event.id, status: event.status };
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        data.slug = await this.uniqueSlug(base);
      }
    }
    throw new ConflictException('Slug already exists');
  }

  async update(id: string, dto: UpdateEventDto, userId: string): Promise<EventResponse> {
    const existing = await this.eventRepository.findById(id);
    const scope = await this.accessScope.resolve(userId, 'event');
    this.assertWritable(existing, scope);
    const data: UpdateEventData = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.thumbnail !== undefined) data.thumbnail = dto.thumbnail;
    if (dto.eventTypeIds !== undefined) data.eventTypeIds = dto.eventTypeIds;
    if (dto.authorIds !== undefined) {
      await this.assertAuthors(dto.authorIds);
      data.authorIds = dto.authorIds;
    }
    if (dto.dates !== undefined)
      data.dates = dto.dates.map((d) => ({ date: new Date(d.date), startTime: d.startTime, endTime: d.endTime }));
    if (dto.location !== undefined) {
      await this.assertLocationGeo(dto.location);
      // `existing.location` = lokasi lama (entity ter-mapping; bukan `locations[]` mentah).
      const prior = existing.location;
      const incomingUrl = dto.location.mapsUrl?.trim() ?? '';
      const existingUrl = prior?.mapsUrl ?? '';
      if (incomingUrl && incomingUrl !== existingUrl) {
        // Link baru/diubah → resolve via jaringan (gagal → 422).
        data.location = await this.resolveLocationMaps(dto.location, 'location.mapsUrl');
      } else {
        // Link sama/kosong → pakai kembali koordinat lama, tanpa panggilan jaringan.
        // ponytail: `mapsUrl` kosong sengaja mempertahankan koordinat lama; untuk menghapus
        // lokasi butuh alur "clear location" eksplisit (bukan sekadar absen/empty mapsUrl).
        data.location = {
          ...dto.location,
          mapsUrl: incomingUrl || existingUrl || null,
          lat: prior?.lat != null ? Number(prior.lat) : dto.location.lat,
          lng: prior?.lng != null ? Number(prior.lng) : dto.location.lng,
          embedUrl: prior?.embedUrl ?? null,
        };
      }
    }
    if (dto.networkId !== undefined) {
      await this.assertNetwork(dto.networkId);
      data.networkId = dto.networkId;
    }
    // Visibility boleh diubah scope `all` maupun `network` (assertWritable sudah membatasi).
    if (dto.visibility !== undefined) data.visibility = dto.visibility;
    if (dto.entry !== undefined) data.entry = dto.entry;

    // Scope != all: status/publishedAt dari body diabaikan (tutup bypass workflow).
    if (scope.kind === 'all') {
      if (dto.publishedAt !== undefined) {
        // Tanggal publish manual: timpa nilai lama (ubah/backdate) + paksa PUBLISHED.
        data.publishedAt = new Date(dto.publishedAt);
        data.status = ContentStatus.PUBLISHED;
        if (!existing.approvedAt) data.approvedAt = new Date();
      } else if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === ContentStatus.PUBLISHED) {
          if (!existing.publishedAt) data.publishedAt = new Date();
          if (!existing.approvedAt) data.approvedAt = new Date();
        }
      }
    } else if (dto.status === ContentStatus.DRAFT && existing.status === ContentStatus.PUBLISHED) {
      // Pemilik/organisasi boleh menarik kembali kontennya yang sudah terbit menjadi DRAFT.
      // `publishedAt`/`approvedAt` dibiarkan (konsisten dengan transisi `unpublish`).
      data.status = ContentStatus.DRAFT;
    }

    return this.toResponse(await this.eventRepository.update(id, data));
  }

  // Transisi status terkontrol; `PATCH /events/:id` tetap untuk update konten.
  // `approve` langsung PUBLISHED (+ `publishedAt`); `publish` legacy (APPROVED → PUBLISHED) tetap ada.
  async transition(
    id: string,
    action: EventAction,
    userId: string,
    options?: { publishedAt?: string },
  ): Promise<EventResponse> {
    const existing = await this.eventRepository.findById(id); // 404 bila tak ada
    const scope = await this.accessScope.resolve(userId, 'event');
    this.assertWritable(existing, scope);
    const rule = EVENT_TRANSITIONS[action];
    if (!rule.from.includes(existing.status)) {
      throw new ConflictException(`Cannot ${action} event in status ${existing.status}`);
    }
    // `updateStatusIf` conditional → dua request paralel dari status sama: hanya satu sukses.
    // `approvedAt` = audit marker "pertama kali terbit" (server-managed), bukan status APPROVED.
    const extra: { approvedAt?: Date; publishedAt?: Date } = {};
    if (action === 'approve' || action === 'publish') {
      extra.publishedAt = options?.publishedAt
        ? new Date(options.publishedAt)
        : (existing.publishedAt ?? new Date());
      extra.approvedAt = existing.approvedAt ?? new Date();
    }
    const updated = await this.eventRepository.updateStatusIf(id, rule.from, rule.to, extra);
    if (!updated) {
      const current = await this.eventRepository.findById(id); // 404 bila event terhapus
      throw new ConflictException(`Cannot ${action} event in status ${current.status}`);
    }
    return this.findOne(id, userId);
  }

  // `skipScopeCheck` hanya untuk purge cascade hapus user (pemanggil sudah otorisasi `admin:access`).
  async remove(
    id: string,
    userId: string,
    options?: { skipScopeCheck?: boolean },
  ): Promise<EventResponse> {
    const existing = await this.eventRepository.findById(id);
    const scope = await this.accessScope.resolve(userId, 'event');
    if (!options?.skipScopeCheck) this.assertWritable(existing, scope);
    return this.toResponse(await this.eventRepository.delete(id));
  }
}
