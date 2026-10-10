import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, UserStatus } from '@prisma/client';
import {
  assertAllowedSort,
  buildOrderBy,
  buildSearch,
  buildWhere,
  combineWhere,
} from '@app/libs/common/utils/list-filter.util';
import type { AuthenticatedUser } from '@app/libs/core/auth/strategies/jwt.strategy';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { ApiKeyRepository } from './api-key.repository';
import { ApiKeyEntity } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

export const API_KEY_FILTER_FIELDS = ['name', 'prefix', 'createdAt', 'updatedAt'];
export const API_KEY_DATE_FIELDS = ['createdAt', 'updatedAt'];
export const API_KEY_SORT_FIELDS = ['name', 'prefix', 'lastUsedAt', 'createdAt', 'updatedAt'];
export const API_KEY_SEARCHABLE_FIELDS = ['name', 'prefix'];

function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly apiKeyRepository: ApiKeyRepository) {}

  async list(query: ListQueryDto): Promise<{ items: ApiKeyEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, API_KEY_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.ApiKeyWhereInput>(query.filter, API_KEY_FILTER_FIELDS, {
      dateFields: API_KEY_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.ApiKeyWhereInput>(
      query.search,
      API_KEY_SEARCHABLE_FIELDS,
    );
    const where = combineWhere<Prisma.ApiKeyWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.apiKeyRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.ApiKeyOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  findOne(id: string): Promise<ApiKeyEntity> {
    return this.apiKeyRepository.findById(id);
  }

  // Raw key HANYA dikembalikan di sini (sekali). DB hanya menyimpan hash.
  async create(dto: CreateApiKeyDto, creatorUserId: string): Promise<ApiKeyEntity & { key: string }> {
    const raw = `gke_${randomBytes(32).toString('base64url')}`;
    const permissionIds = await this.resolvePermissionIds(dto.permissionCodes);
    const entity = await this.apiKeyRepository.create({
      name: dto.name,
      keyHash: hashApiKey(raw),
      prefix: raw.slice(0, 12),
      createdBy: creatorUserId,
      permissionIds,
    });
    return { ...entity, key: raw };
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<ApiKeyEntity> {
    await this.apiKeyRepository.findById(id); // 404 lebih dulu

    // Validasi code SEBELUM menulis apa pun, lalu name + permissions dalam satu transaksi.
    const permissionIds =
      dto.permissionCodes === undefined
        ? undefined
        : await this.resolvePermissionIds(dto.permissionCodes);
    const data: Prisma.ApiKeyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    return this.apiKeyRepository.update(id, data, permissionIds);
  }

  // Hard delete (bukan revoke): akses dicabut permanen.
  async remove(id: string): Promise<void> {
    await this.apiKeyRepository.remove(id);
  }

  async authenticate(raw: string): Promise<AuthenticatedUser> {
    const found = await this.apiKeyRepository.findByHash(hashApiKey(raw));
    if (!found || found.creator.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid API key');
    }
    // Best-effort, tidak di-await & error diabaikan.
    this.apiKeyRepository.touchLastUsed(found.id).catch(() => undefined);
    return {
      id: found.creator.id,
      email: found.creator.email,
      jti: '',
      exp: 0,
      isMember: false,
      apiKeyId: found.id,
      permissions: found.permissions.map((p) => p.permission.code),
    };
  }

  private async resolvePermissionIds(codes: string[]): Promise<string[]> {
    const unique = [...new Set(codes)];
    const found = await this.apiKeyRepository.findPermissionsByCodes(unique);
    const idByCode = new Map(found.map((p) => [p.code, p.id]));
    const missing = unique.filter((code) => !idByCode.has(code));
    if (missing.length > 0) {
      throw new UnprocessableEntityException(
        `Unknown permission code(s): ${missing.join(', ')}`,
      );
    }
    return unique.map((code) => idByCode.get(code) as string);
  }
}
