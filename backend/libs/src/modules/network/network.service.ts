import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ContentSource, NetworkStatus, Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { sanitizeStoryContent } from '@app/libs/common/utils/sanitize.util';
import { resolveGoogleMapsLink } from '@app/libs/common/utils/google-maps.util';
import { CountryRepository } from '@app/libs/modules/country/country.repository';
import { StateRepository } from '@app/libs/modules/state/state.repository';
import { UserService } from '@app/libs/modules/user/user.service';
import { NetworkRepository } from './network.repository';
import { NetworkEntity } from './entities/network.entity';
import { CreateNetworkDto } from './dto/create-network.dto';
import { UpdateNetworkDto } from './dto/update-network.dto';
import { CreatePublicNetworkDto } from './dto/create-public-network.dto';

export const NETWORK_SEARCHABLE_FIELDS = ['name', 'state', 'country', 'address', 'website', 'contact'];
export const NETWORK_SORT_FIELDS = ['name', 'state', 'country', 'address', 'website', 'contact', 'status', 'createdAt', 'updatedAt'];
export const NETWORK_FILTER_FIELDS = ['name', 'state', 'country', 'website', 'contact', 'status', 'source', 'createdAt', 'updatedAt'];
export const NETWORK_DATE_FIELDS = ['createdAt', 'updatedAt'];

export type NetworkAction = 'approve' | 'reject';

// Sumber tunggal aturan transisi status network (mirror ARCHIVE_TRANSITIONS).
export const NETWORK_TRANSITIONS: Record<NetworkAction, { from: NetworkStatus; to: NetworkStatus }> = {
  approve: { from: NetworkStatus.REQUEST, to: NetworkStatus.PUBLISHED },
  reject: { from: NetworkStatus.REQUEST, to: NetworkStatus.DRAFT },
};

@Injectable()
export class NetworkService {
  constructor(
    private readonly networkRepository: NetworkRepository,
    private readonly countryRepository: CountryRepository,
    private readonly stateRepository: StateRepository,
    private readonly userService: UserService,
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
    const searchWhere = buildSearch<Prisma.NetworkWhereInput>(query.search, NETWORK_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.NetworkWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.networkRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.NetworkOrderByWithRelationInput>(query.sortBy, query.sortOrder),
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
    return this.networkRepository.create(
      {
        name: dto.name,
        state: dto.state,
        country: dto.country,
        address: dto.address,
        content: dto.content === undefined ? undefined : sanitizeStoryContent(dto.content),
        website: dto.website ?? null,
        mapsUrl: dto.mapsUrl ?? null,
        contact: dto.contact ?? null,
        organisationType: dto.organisationType ?? null,
        ledBy: dto.ledBy ?? null,
        activityType: dto.activityType ?? null,
        socialMedia: this.socialMediaJson(dto.socialMedia),
        lat: coords?.lat ?? dto.lat,
        lng: coords?.lng ?? dto.lng,
        embedUrl: coords?.embedUrl ?? null,
      },
      tx,
    );
  }

  async update(id: string, dto: UpdateNetworkDto): Promise<NetworkEntity> {
    const data: Prisma.NetworkUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.content !== undefined) data.content = sanitizeStoryContent(dto.content);
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.contact !== undefined) data.contact = dto.contact;
    if (dto.organisationType !== undefined) data.organisationType = dto.organisationType;
    if (dto.ledBy !== undefined) data.ledBy = dto.ledBy;
    if (dto.activityType !== undefined) data.activityType = dto.activityType;
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
  private async assertGeography(
    countryId: number,
    stateId: number | undefined,
    countryField: string,
    stateField: string,
  ): Promise<void> {
    const country = await this.countryRepository.findByIdOrNull(countryId);
    if (!country) throw this.validationError(countryField, `${countryField} does not exist`);
    if (stateId != null) {
      const state = await this.stateRepository.findByIdOrNull(stateId);
      if (!state || state.countryId !== countryId) {
        throw this.validationError(stateField, `${stateField} must belong to ${countryField}`);
      }
    }
  }

  // Submit publik (tanpa JWT): tulis langsung `Network` status REQUEST, source PUBLIC.
  // Respons hanya { id, status } (tanpa echo row/PII). Resolve country/state id → nama display.
  async createPublicSubmission(dto: CreatePublicNetworkDto): Promise<{ id: string; status: NetworkStatus }> {
    await this.assertGeography(dto.countryId, dto.stateId, 'countryId', 'stateId');
    await this.assertGeography(
      dto.submitter.countryId,
      dto.submitter.stateId,
      'submitter.countryId',
      'submitter.stateId',
    );

    const content = sanitizeStoryContent(dto.content);
    if (!content.trim()) {
      throw this.validationError('content', 'content is empty after sanitization');
    }

    // Resolve link Maps sebelum membuat User/Network agar link invalid tak meninggalkan orphan record.
    const coords = await this.resolveLocationMaps(dto.mapsUrl);

    const country = await this.countryRepository.findByIdOrNull(dto.countryId);
    const state = dto.stateId == null ? null : await this.stateRepository.findByIdOrNull(dto.stateId);
    // Negara submitter (bukan negara organisasi) → cegah User lintas-negara.
    const submitterCountry = await this.countryRepository.findByIdOrNull(dto.submitter.countryId);
    if (!submitterCountry) {
      throw this.validationError('submitter.countryId', 'submitter.countryId does not exist');
    }

    const user = await this.userService.findOrCreatePublicUser({
      fullName: dto.submitter.fullName,
      email: dto.submitter.email,
      countryId: submitterCountry.iso2,
      stateId: dto.submitter.stateId ?? null,
    });

    const network = await this.networkRepository.create({
      name: dto.name,
      state: state?.name ?? null,
      country: country!.name,
      address: dto.address ?? null,
      content,
      website: dto.website ?? null,
      contact: dto.contact,
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
      createdBy: user.id,
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
    if (existing.status !== rule.from) {
      throw new ConflictException(`Cannot ${action} network in status ${existing.status}`);
    }
    const extra: { approvedAt?: Date; publishedAt?: Date } = {};
    if (action === 'approve') {
      extra.publishedAt = options?.publishedAt
        ? new Date(options.publishedAt)
        : (existing.publishedAt ?? new Date());
      extra.approvedAt = existing.approvedAt ?? new Date();
    }
    const updated = await this.networkRepository.updateStatusIf(id, rule.from, rule.to, extra);
    if (!updated) {
      const current = await this.networkRepository.findById(id); // 404 bila terhapus
      throw new ConflictException(`Cannot ${action} network in status ${current.status}`);
    }
    return updated;
  }

  approve(id: string, options?: { publishedAt?: string }): Promise<NetworkEntity> {
    return this.transition(id, 'approve', options);
  }

  reject(id: string): Promise<NetworkEntity> {
    return this.transition(id, 'reject');
  }
}
