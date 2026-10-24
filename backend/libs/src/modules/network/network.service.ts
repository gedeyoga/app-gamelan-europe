import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContentSource, NetworkStatus, NotificationEntityType, NotificationType, Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { sanitizeStoryContent } from '@app/libs/common/utils/sanitize.util';
import { resolveGoogleMapsLink } from '@app/libs/common/utils/google-maps.util';
import { CountryRepository } from '@app/libs/modules/country/country.repository';
import { StateRepository } from '@app/libs/modules/state/state.repository';
import { CityRepository } from '@app/libs/modules/city/city.repository';
import { CountryEntity } from '@app/libs/modules/country/entities/country.entity';
import { StateWithCountryEntity } from '@app/libs/modules/state/entities/state.entity';
import { NotificationService } from '@app/libs/modules/notification/notification.service';
import { NetworkRepository } from './network.repository';
import { NetworkEntity } from './entities/network.entity';
import { CreateNetworkDto } from './dto/create-network.dto';
import { UpdateNetworkDto } from './dto/update-network.dto';
import { CreatePublicNetworkDto } from './dto/create-public-network.dto';

export const NETWORK_SEARCHABLE_FIELDS = ['name', 'state', 'country', 'address', 'website', 'contact'];
export const NETWORK_SORT_FIELDS = ['name', 'ledBy', 'state', 'country', 'city', 'address', 'website', 'contact', 'status', 'createdAt', 'updatedAt'];
export const NETWORK_FILTER_FIELDS = ['name', 'state', 'country', 'website', 'contact', 'status', 'source', 'createdAt', 'updatedAt'];
export const NETWORK_DATE_FIELDS = ['createdAt', 'updatedAt'];

export type NetworkAction = 'submit' | 'approve' | 'reject' | 'unpublish';

// Target bulk status + permission yang cukup (salah satu) — cegah eskalasi via `network:update`.
// APPROVED sengaja tak ada: tak ada transisi yang menghasilkan APPROVED (approve → PUBLISHED).
export const NETWORK_BULK_STATUS: Partial<Record<NetworkStatus, string[]>> = {
  [NetworkStatus.PUBLISHED]: ['network:approve'],
  [NetworkStatus.REQUEST]: ['network:update'],
  [NetworkStatus.DRAFT]: ['network:reject', 'network:unpublish'],
};

// Sumber tunggal aturan transisi status network (mirror EVENT_TRANSITIONS).
// `from` berupa array: `approve` boleh langsung dari DRAFT (tanpa `submit`).
export const NETWORK_TRANSITIONS: Record<NetworkAction, { from: NetworkStatus[]; to: NetworkStatus }> = {
  submit: { from: [NetworkStatus.DRAFT], to: NetworkStatus.REQUEST },
  approve: { from: [NetworkStatus.DRAFT, NetworkStatus.REQUEST], to: NetworkStatus.PUBLISHED },
  reject: { from: [NetworkStatus.REQUEST], to: NetworkStatus.DRAFT },
  unpublish: { from: [NetworkStatus.PUBLISHED], to: NetworkStatus.DRAFT },
};

@Injectable()
export class NetworkService {
  constructor(
    private readonly networkRepository: NetworkRepository,
    private readonly countryRepository: CountryRepository,
    private readonly stateRepository: StateRepository,
    private readonly cityRepository: CityRepository,
    private readonly notificationService: NotificationService,
  ) {}

  private validationError(field: string, message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      errors: [{ field, message }],
    });
  }

  async list(query: ListQueryDto): Promise<{ items: NetworkEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, NETWORK_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.NetworkWhereInput>(query.filter, NETWORK_FILTER_FIELDS, {
      enumFields: {
        status: ['DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED'],
        source: ['PUBLIC', 'REGISTERED'],
      },
      dateFields: NETWORK_DATE_FIELDS,
    });
    // PUBLISHED publik = sudah terbit (mirror archive.scopeWhere); jadwal masa depan disembunyikan.
    if (query.filter?.status === NetworkStatus.PUBLISHED) {
      filterWhere.publishedAt = { not: null, lte: new Date() };
    }
    const searchWhere = buildSearch<Prisma.NetworkWhereInput>(query.search, NETWORK_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.NetworkWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.networkRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.NetworkOrderByWithRelationInput>(query.sortBy, query.sortOrder, { city: 'city.name' }),
    });
  }

  findOne(id: string): Promise<NetworkEntity> {
    return this.networkRepository.findById(id);
  }

  // Find-or-create untuk submit event publik (submit langsung ke tabel `events`).
  // `name` tidak unik → findFirst case-insensitive; typo bisa membuat network duplikat (backlog).
  // Opsi `tx` dipakai bila dipanggil di dalam transaksi caller (approve).
  async findOrCreateByName(
    name: string,
    options: { state?: string | null; country?: string | null; tx?: Prisma.TransactionClient } = {},
  ): Promise<NetworkEntity> {
    const trimmed = name.trim();
    const existing = await this.networkRepository.findByNameInsensitive(trimmed, options.tx);
    if (existing) return existing;
    return this.networkRepository.create(
      { name: trimmed, state: options.state ?? null, country: options.country ?? null },
      options.tx,
    );
  }

  // `socialMedia` → plain `{ platform, url }[]` agar assignable ke `Prisma.InputJsonValue`.
  private socialMediaJson(value: CreateNetworkDto['socialMedia']): Prisma.InputJsonValue | undefined {
    return value?.map(({ platform, url }) => ({ platform, url }));
  }

  // Resolve `mapsUrl` → koordinat server-side (mirror event.resolveLocationMaps). Kosong → `null`.
  // Gagal resolve (bukan link Google Maps / tanpa koordinat) → 422 per-field `mapsUrl`.
  private async resolveLocationMaps(mapsUrl?: string | null): Promise<{ lat: number; lng: number; embedUrl: string } | null> {
    if (!mapsUrl) return null;
    const resolved = await resolveGoogleMapsLink(mapsUrl);
    if (!resolved) {
      throw this.validationError('mapsUrl', 'mapsUrl must be a Google Maps link with resolvable coordinates');
    }
    return { lat: resolved.lat, lng: resolved.lng, embedUrl: resolved.embedUrl };
  }

  // Opsi `tx` dipakai bila dipanggil di dalam transaksi caller (approve network submission).
  async create(dto: CreateNetworkDto, tx?: Prisma.TransactionClient): Promise<NetworkEntity> {
    // Resolved link menimpa `lat`/`lng` klien.
    const coords = await this.resolveLocationMaps(dto.mapsUrl);

    // ID menang atas string nama; tanpa id, perilaku lama (simpan nama apa adanya).
    let countryName: string | null | undefined = dto.country;
    let stateName: string | null | undefined = dto.state;
    if (dto.countryId != null || dto.stateId != null) {
      if (dto.countryId == null) {
        throw this.validationError('countryId', 'countryId is required when stateId is sent');
      }
      const geo = await this.assertGeography(dto.countryId, dto.stateId ?? undefined, 'countryId', 'stateId');
      countryName = geo.country.name;
      stateName = geo.state?.name ?? null;
    }
    if (dto.cityId != null) {
      if (dto.countryId == null) {
        throw this.validationError('countryId', 'countryId is required when cityId is sent');
      }
      await this.assertCity(dto.cityId, dto.countryId, dto.stateId ?? undefined);
    }

    return this.networkRepository.create(
      {
        name: dto.name,
        state: stateName,
        country: countryName,
        address: dto.address,
        content: dto.content === undefined ? undefined : sanitizeStoryContent(dto.content),
        website: dto.website ?? null,
        mapsUrl: dto.mapsUrl ?? null,
        contact: dto.contact ?? null,
        organisationType: dto.organisationType ?? null,
        ledBy: dto.ledBy ?? null,
        activityType: dto.activityType ?? null,
        submitterEmail: dto.submitterEmail ?? null,
        socialMedia: this.socialMediaJson(dto.socialMedia),
        lat: coords?.lat ?? dto.lat,
        lng: coords?.lng ?? dto.lng,
        embedUrl: coords?.embedUrl ?? null,
        countryId: dto.countryId ?? null,
        stateId: dto.stateId ?? null,
        cityId: dto.cityId ?? null,
      },
      tx,
    );
  }

  async update(id: string, dto: UpdateNetworkDto): Promise<NetworkEntity> {
    const data: Prisma.NetworkUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;

    // Geo: hanya field yang dikirim yang disentuh. `null` eksplisit = kosongkan.
    // Anak yang tidak lagi cocok dengan induk baru dibuang kecuali dikirim ulang.
    const touchesGeo = dto.countryId !== undefined || dto.stateId !== undefined || dto.cityId !== undefined;
    const existing = touchesGeo ? await this.networkRepository.findById(id) : undefined;

    if (existing) {
      const countryProvided = dto.countryId !== undefined;
      const stateProvided = dto.stateId !== undefined;
      const cityProvided = dto.cityId !== undefined;
      const countryChanged = countryProvided && dto.countryId !== existing.countryId;

      const effectiveCountryId = countryProvided ? (dto.countryId ?? null) : existing.countryId;
      // Negara berubah → state lama dibuang kecuali state dikirim ulang.
      let effectiveStateId = stateProvided ? (dto.stateId ?? null) : existing.stateId;
      if (countryChanged && !stateProvided) effectiveStateId = null;
      // Negara/state berubah → city lama dibuang kecuali city dikirim ulang.
      const effectiveCityId = cityProvided ? (dto.cityId ?? null) : (countryChanged || stateProvided ? null : existing.cityId);

      if (effectiveCountryId == null) {
        if (effectiveStateId != null) {
          throw this.validationError('countryId', 'countryId is required when stateId is sent');
        }
        if (effectiveCityId != null) {
          throw this.validationError('countryId', 'countryId is required when cityId is sent');
        }
      }

      // Validasi rantai hanya saat induk disentuh; hasil lookup dipakai untuk nama display.
      const geo =
        effectiveCountryId != null && (countryProvided || stateProvided)
          ? await this.assertGeography(effectiveCountryId, effectiveStateId ?? undefined, 'countryId', 'stateId')
          : null;

      if (countryProvided) {
        data.countryId = dto.countryId ?? null;
        data.country = dto.countryId == null ? null : (geo?.country.name ?? null);
      }
      if (stateProvided || countryChanged) {
        data.stateId = effectiveStateId;
        data.state = effectiveStateId == null ? null : (geo?.state?.name ?? null);
      }
      if (cityProvided) {
        if (effectiveCityId != null) {
          await this.assertCity(effectiveCityId, effectiveCountryId!, effectiveStateId ?? undefined);
        }
        data.cityId = effectiveCityId;
      } else if (countryChanged || stateProvided) {
        data.cityId = null;
      }
    }

    // Tanpa id geo: perilaku lama, string nama bebas (kompatibilitas).
    if (!touchesGeo) {
      if (dto.state !== undefined) data.state = dto.state;
      if (dto.country !== undefined) data.country = dto.country;
    }

    if (dto.content !== undefined) data.content = sanitizeStoryContent(dto.content);
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.contact !== undefined) data.contact = dto.contact;
    if (dto.organisationType !== undefined) data.organisationType = dto.organisationType;
    if (dto.ledBy !== undefined) data.ledBy = dto.ledBy;
    if (dto.activityType !== undefined) data.activityType = dto.activityType;
    if (dto.submitterEmail !== undefined) data.submitterEmail = dto.submitterEmail;
    if (dto.socialMedia !== undefined) {
      data.socialMedia = dto.socialMedia === null ? Prisma.DbNull : this.socialMediaJson(dto.socialMedia);
    }
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    // `mapsUrl` diproses terakhir → link ter-resolve menang atas `lat`/`lng` eksplisit.
    // Link kosong → kosongkan `mapsUrl` (koordinat lama tetap, mirror event). Link tidak berubah → tanpa jaringan.
    if (dto.mapsUrl !== undefined) {
      const incomingUrl = dto.mapsUrl?.trim() ?? '';
      if (incomingUrl) {
        const existing = await this.networkRepository.findById(id);
        if (incomingUrl !== (existing.mapsUrl ?? '') || existing.lat == null || existing.lng == null) {
          const coords = await this.resolveLocationMaps(incomingUrl);
          if (coords) {
            data.lat = coords.lat;
            data.lng = coords.lng;
            data.embedUrl = coords.embedUrl;
          }
        }
      }
      data.mapsUrl = incomingUrl || null;
    }
    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }
    return this.networkRepository.update(id, data);
  }

  remove(id: string): Promise<NetworkEntity> {
    return this.networkRepository.remove(id);
  }

  // `countryId` harus ada; `stateId` bila dikirim harus milik `countryId` → 422 per-field.
  // Mengembalikan row hasil lookup agar pemanggil tak query ulang (butuh `name`).
  private async assertGeography(
    countryId: number,
    stateId: number | undefined,
    countryField: string,
    stateField: string,
  ): Promise<{ country: CountryEntity; state: StateWithCountryEntity | null }> {
    const country = await this.countryRepository.findByIdOrNull(countryId);
    if (!country) throw this.validationError(countryField, `${countryField} does not exist`);
    if (stateId == null) return { country, state: null };
    const state = await this.stateRepository.findByIdOrNull(stateId);
    if (!state || state.countryId !== countryId) {
      throw this.validationError(stateField, `${stateField} must belong to ${countryField}`);
    }
    return { country, state };
  }

  // `cityId` harus milik `countryId`; bila city punya state, `stateId` wajib dikirim dan harus cocok
  // (mirror event.assertLocationGeo) → 422 `stateId`/`cityId`.
  private async assertCity(cityId: number, countryId: number, stateId?: number | null): Promise<void> {
    const city = await this.cityRepository.findByIdOrNull(cityId);
    if (!city || city.countryId !== countryId) {
      throw this.validationError('cityId', 'cityId must exist and match countryId/stateId');
    }
    if (city.stateId != null) {
      if (stateId == null) {
        throw this.validationError('stateId', 'stateId is required when cityId belongs to a state');
      }
      if (city.stateId !== stateId) {
        throw this.validationError('cityId', 'cityId must belong to stateId');
      }
    } else if (stateId != null) {
      throw this.validationError('cityId', 'cityId must belong to stateId');
    }
  }

  // Submit publik (tanpa JWT): tulis langsung `Network` status REQUEST, source PUBLIC.
  // Identitas pengirim (email saja) disimpan di kolom `submitter_email` (tanpa membuat `User`); `createdBy` = null.
  // Respons hanya { id, status } (tanpa echo row/PII). Resolve country/state id → nama display.
  async createPublicSubmission(dto: CreatePublicNetworkDto): Promise<{ id: string; status: NetworkStatus }> {
    const { country, state } = await this.assertGeography(dto.countryId, dto.stateId, 'countryId', 'stateId');
    if (dto.cityId != null) await this.assertCity(dto.cityId, dto.countryId, dto.stateId);

    const content = sanitizeStoryContent(dto.content);
    if (!content.trim()) {
      throw this.validationError('content', 'content is empty after sanitization');
    }

    // Resolve link Maps sebelum insert agar link invalid tak meninggalkan row tersimpan.
    const coords = await this.resolveLocationMaps(dto.mapsUrl);

    const network = await this.networkRepository.create({
      name: dto.name,
      state: state?.name ?? null,
      country: country.name,
      address: dto.address ?? null,
      content,
      website: dto.website ?? null,
      contact: dto.contact ?? null,
      socialMedia: this.socialMediaJson(dto.socialMedia),
      status: NetworkStatus.REQUEST,
      source: ContentSource.PUBLIC,
      organisationType: dto.organisationType,
      ledBy: dto.ledBy ?? null,
      mapsUrl: dto.mapsUrl ?? null,
      activityType: dto.activityType ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      embedUrl: coords?.embedUrl ?? null,
      countryId: dto.countryId,
      stateId: dto.stateId ?? null,
      cityId: dto.cityId ?? null,
      submitterEmail: dto.submitter.email,
      createdBy: null,
    });
    await this.notificationService.notifyAdmins({
      type: NotificationType.CONTENT_SUBMITTED,
      entityType: NotificationEntityType.NETWORK,
      entityId: network.id,
      title: dto.name,
      details: [
        { label: 'Submitted by', value: dto.name },
        { label: 'Email', value: dto.submitter.email },
        { label: 'Type', value: 'Network' },
      ],
      imageUrl: null,
      linkPath: '/dashboard',
    });
    return { id: network.id, status: network.status };
  }

  // Transisi status terkontrol (mirror archive.transition): conditional update anti-TOCTOU.
  // `approve` langsung PUBLISHED (+ publishedAt/approvedAt); wrong status → 409, missing → 404.
  async transition(
    id: string,
    action: NetworkAction,
    options?: { publishedAt?: string },
  ): Promise<NetworkEntity> {
    const existing = await this.networkRepository.findById(id); // 404 bila tak ada
    const rule = NETWORK_TRANSITIONS[action];
    if (!rule.from.includes(existing.status)) {
      throw new ConflictException(`Cannot ${action} network in status ${existing.status}`);
    }
    const extra: { approvedAt?: Date; publishedAt?: Date } = {};
    if (action === 'approve') {
      extra.publishedAt = options?.publishedAt
        ? new Date(options.publishedAt)
        : (existing.publishedAt ?? new Date());
      extra.approvedAt = existing.approvedAt ?? new Date();
    }
    // Predikat = status aktual hasil baca (bukan seluruh array) → balapan tetap 409.
    const updated = await this.networkRepository.updateStatusIf(id, existing.status, rule.to, extra);
    if (!updated) {
      const current = await this.networkRepository.findById(id); // 404 bila terhapus
      throw new ConflictException(`Cannot ${action} network in status ${current.status}`);
    }
    // Submit (member/admin, termasuk bulk) → notifikasi admin, sama seperti jalur publik.
    // `notifyAdmins` menelan error sendiri: kegagalan notifikasi tidak menggagalkan submit.
    if (action === 'submit') {
      await this.notificationService.notifyAdmins({
        type: NotificationType.CONTENT_SUBMITTED,
        entityType: NotificationEntityType.NETWORK,
        entityId: updated.id,
        title: updated.name,
        details: [
          { label: 'Submitted by', value: updated.name },
          { label: 'Email', value: updated.submitterEmail },
          { label: 'Type', value: 'Network' },
        ],
        imageUrl: null,
        linkPath: '/networks',
      });
    }
    return updated;
  }

  approve(id: string, options?: { publishedAt?: string }): Promise<NetworkEntity> {
    return this.transition(id, 'approve', options);
  }

  reject(id: string): Promise<NetworkEntity> {
    return this.transition(id, 'reject');
  }

  submit(id: string): Promise<NetworkEntity> {
    return this.transition(id, 'submit');
  }

  unpublish(id: string): Promise<NetworkEntity> {
    return this.transition(id, 'unpublish');
  }

  // Bulk status: per-id lewat `transition` (aturan transisi + timestamp tetap berlaku).
  // APPROVED ditolak 400: tak ada transisi yang menghasilkannya. Kandidat aksi hanya yang
  // permission-nya dipegang (bulk tak boleh lebih longgar dari endpoint tunggal).
  // 404/409 → `skipped` (row hilang / sudah di status target); 403 & error lain → `failed`.
  async bulkUpdateStatus(
    ids: string[],
    status: NetworkStatus,
    permissions: string[] = [],
  ): Promise<{ updated: number; skipped: number; failed: number }> {
    const required = NETWORK_BULK_STATUS[status];
    if (!required) {
      throw new BadRequestException(`Bulk status target ${status} is not supported`);
    }
    if (!required.some((permission) => permissions.includes(permission))) {
      throw new ForbiddenException(`Bulk status ${status} requires permission ${required.join(' or ')}`);
    }
    const candidates: NetworkAction[] =
      status === NetworkStatus.PUBLISHED
        ? ['approve']
        : status === NetworkStatus.REQUEST
          ? ['submit']
          : [
              ...(permissions.includes('network:reject') ? (['reject'] as const) : []),
              ...(permissions.includes('network:unpublish') ? (['unpublish'] as const) : []),
            ];
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    for (const id of ids) {
      let outcome: 'updated' | 'skipped' | 'failed' = 'skipped';
      for (const action of candidates) {
        try {
          await this.transition(id, action);
          outcome = 'updated';
          break;
        } catch (e) {
          if (!(e instanceof HttpException)) throw e;
          if (!(e instanceof NotFoundException || e instanceof ConflictException)) outcome = 'failed';
        }
      }
      if (outcome === 'updated') updated++;
      else if (outcome === 'failed') failed++;
      else skipped++;
    }
    return { updated, skipped, failed };
  }
}
