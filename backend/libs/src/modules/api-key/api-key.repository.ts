import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import {
  apiKeySelect,
  apiKeyAuthSelect,
  ApiKeyEntity,
  ApiKeyAuthPayload,
  mapApiKey,
} from './entities/api-key.entity';

export interface CreateApiKeyData {
  name: string;
  keyHash: string;
  prefix: string;
  createdBy: string;
  permissionIds: string[];
}

export interface FindManyApiKeysParams {
  where: Prisma.ApiKeyWhereInput;
  skip: number;
  take: number;
  orderBy: Prisma.ApiKeyOrderByWithRelationInput;
}

@Injectable()
export class ApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ApiKeyEntity> {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id }, select: apiKeySelect });
    if (!apiKey) throw new NotFoundException('API key not found');
    return mapApiKey(apiKey);
  }

  async findMany(
    params: FindManyApiKeysParams,
  ): Promise<{ items: ApiKeyEntity[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.apiKey.findMany({ ...params, select: apiKeySelect }),
      this.prisma.apiKey.count({ where: params.where }),
    ]);
    return { items: items.map(mapApiKey), total };
  }

  // Dipakai `x-api-key` auth; hanya mengembalikan principal + permission code.
  findByHash(keyHash: string): Promise<ApiKeyAuthPayload | null> {
    return this.prisma.apiKey.findUnique({ where: { keyHash }, select: apiKeyAuthSelect });
  }

  async create(data: CreateApiKeyData): Promise<ApiKeyEntity> {
    const { permissionIds, ...rest } = data;
    const created = await this.prisma.apiKey.create({
      data: {
        ...rest,
        // Nested write: ApiKey + join permission atomik (tidak perlu $transaction manual).
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
      select: apiKeySelect,
    });
    return mapApiKey(created);
  }

  // Name + replace-all permission dalam SATU transaksi → tidak ada partial write.
  async update(
    id: string,
    data: Prisma.ApiKeyUpdateInput,
    permissionIds?: string[],
  ): Promise<ApiKeyEntity> {
    await this.assertExists(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.apiKey.update({ where: { id }, data, select: { id: true } });
      }
      if (permissionIds) {
        await tx.apiKeyPermission.deleteMany({ where: { apiKeyId: id } });
        await tx.apiKeyPermission.createMany({
          data: permissionIds.map((permissionId) => ({ apiKeyId: id, permissionId })),
        });
      }
      return tx.apiKey.findUniqueOrThrow({ where: { id }, select: apiKeySelect });
    });
    return mapApiKey(updated);
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.apiKey.delete({ where: { id } });
  }

  // Best-effort: pemanggil mengabaikan error (tidak boleh menggagalkan request).
  touchLastUsed(id: string): Promise<unknown> {
    return this.prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }

  findPermissionsByCodes(codes: string[]): Promise<{ id: string; code: string }[]> {
    return this.prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
  }

  private async assertExists(id: string): Promise<void> {
    const existing = await this.prisma.apiKey.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('API key not found');
  }
}
