import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { PermissionRepository } from './permission.repository';
import { PermissionEntity } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

export const PERMISSION_FILTER_FIELDS = ['code', 'createdAt', 'updatedAt'];
export const PERMISSION_DATE_FIELDS = ['createdAt', 'updatedAt'];
// Semua kolom yang ditampilkan di menu Permission wajib sortable.
export const PERMISSION_SORT_FIELDS = ['code', 'description', 'createdAt', 'updatedAt'];
// Global search bar menu Permission: OR like ke kolom-kolom ini.
export const PERMISSION_SEARCHABLE_FIELDS = ['code', 'description'];

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepository: PermissionRepository) {}

  async list(query: ListQueryDto): Promise<{ items: PermissionEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, PERMISSION_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.PermissionWhereInput>(
      query.filter,
      PERMISSION_FILTER_FIELDS,
      { dateFields: PERMISSION_DATE_FIELDS },
    );
    const searchWhere = buildSearch<Prisma.PermissionWhereInput>(
      query.search,
      PERMISSION_SEARCHABLE_FIELDS,
    );
    const where = combineWhere<Prisma.PermissionWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.permissionRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.PermissionOrderByWithRelationInput>(
        query.sortBy,
        query.sortOrder,
      ),
    });
  }

  findOne(id: string): Promise<PermissionEntity> {
    return this.permissionRepository.findById(id);
  }

  create(dto: CreatePermissionDto): Promise<PermissionEntity> {
    return this.permissionRepository.create({
      code: dto.code,
      description: dto.description,
    });
  }

  update(id: string, dto: UpdatePermissionDto): Promise<PermissionEntity> {
    const data: Prisma.PermissionUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.description !== undefined) data.description = dto.description;
    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }
    return this.permissionRepository.update(id, data);
  }

  remove(id: string): Promise<PermissionEntity> {
    return this.permissionRepository.remove(id);
  }

  getPermissionCodesByUserId(userId: string): Promise<string[]> {
    return this.permissionRepository.findCodesByUserId(userId);
  }
}