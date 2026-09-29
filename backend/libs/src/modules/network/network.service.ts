import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { sanitizeStoryContent } from '@app/libs/common/utils/sanitize.util';
import { NetworkRepository } from './network.repository';
import { NetworkEntity } from './entities/network.entity';
import { CreateNetworkDto } from './dto/create-network.dto';
import { UpdateNetworkDto } from './dto/update-network.dto';

export const NETWORK_SEARCHABLE_FIELDS = ['name', 'state', 'country', 'address', 'website', 'contact'];
export const NETWORK_SORT_FIELDS = ['name', 'state', 'country', 'address', 'website', 'contact', 'createdAt', 'updatedAt'];
export const NETWORK_FILTER_FIELDS = ['name', 'state', 'country', 'website', 'contact', 'createdAt', 'updatedAt'];
export const NETWORK_DATE_FIELDS = ['createdAt', 'updatedAt'];

@Injectable()
export class NetworkService {
  constructor(private readonly networkRepository: NetworkRepository) {}

  async list(query: ListQueryDto): Promise<{ items: NetworkEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, NETWORK_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.NetworkWhereInput>(query.filter, NETWORK_FILTER_FIELDS, {
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

  // Find-or-create untuk approve submission publik (event-submission §5.2.1).
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

  create(dto: CreateNetworkDto): Promise<NetworkEntity> {
    return this.networkRepository.create({
      name: dto.name,
      state: dto.state,
      country: dto.country,
      address: dto.address,
      content: dto.content === undefined ? undefined : sanitizeStoryContent(dto.content),
      website: dto.website ?? null,
      contact: dto.contact ?? null,
      socialMedia: this.socialMediaJson(dto.socialMedia),
      lat: dto.lat,
      lng: dto.lng,
    });
  }

  update(id: string, dto: UpdateNetworkDto): Promise<NetworkEntity> {
    const data: Prisma.NetworkUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.content !== undefined) data.content = sanitizeStoryContent(dto.content);
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.contact !== undefined) data.contact = dto.contact;
    if (dto.socialMedia !== undefined) {
      data.socialMedia = dto.socialMedia === null ? Prisma.DbNull : this.socialMediaJson(dto.socialMedia);
    }
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lng !== undefined) data.lng = dto.lng;
    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }
    return this.networkRepository.update(id, data);
  }

  remove(id: string): Promise<NetworkEntity> {
    return this.networkRepository.remove(id);
  }
}
