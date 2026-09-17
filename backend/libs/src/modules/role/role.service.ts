import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildWhere, assertAllowedSort, buildSearch, combineWhere, buildOrderBy } from '@app/libs/common/utils/list-filter.util';
import { ListQueryDto } from '@app/libs/common/dto/list-query.dto';
import { RoleRepository } from './role.repository';
import { RoleEntity, RoleWithPermissionsEntity } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolePermissionService } from '@app/libs/modules/role-permissions/role-permission.service';
import { RolePermissionEntity } from '@app/libs/modules/role-permissions/entities/role-permission.entity';

export const ROLE_FILTER_FIELDS = ['name', 'createdAt', 'updatedAt'];
export const ROLE_DATE_FIELDS = ['createdAt', 'updatedAt'];
// Semua kolom yang ditampilkan di menu Roles wajib sortable.
export const ROLE_SORT_FIELDS = ['name', 'description', 'createdAt', 'updatedAt'];
// Global search bar menu Roles: OR like ke kolom-kolom ini.
export const ROLE_SEARCHABLE_FIELDS = ['name', 'description'];

@Injectable()
export class RoleService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly rolePermissionService: RolePermissionService,
  ) {}

  async list(query: ListQueryDto): Promise<{ items: RoleEntity[]; total: number }> {
    const take = Math.min(query.limit, 100);
    const skip = (query.page - 1) * take;
    assertAllowedSort(query.sortBy, ROLE_SORT_FIELDS);
    const filterWhere = buildWhere<Prisma.RoleWhereInput>(query.filter, ROLE_FILTER_FIELDS, {
      dateFields: ROLE_DATE_FIELDS,
    });
    const searchWhere = buildSearch<Prisma.RoleWhereInput>(query.search, ROLE_SEARCHABLE_FIELDS);
    const where = combineWhere<Prisma.RoleWhereInput>(
      filterWhere as unknown as Record<string, unknown>,
      searchWhere as unknown as Record<string, unknown> | undefined,
    );
    return this.roleRepository.findMany({
      where,
      skip,
      take,
      orderBy: buildOrderBy<Prisma.RoleOrderByWithRelationInput>(query.sortBy, query.sortOrder),
    });
  }

  findOne(id: string): Promise<RoleEntity> {
    return this.roleRepository.findById(id);
  }

  findOneWithPermissions(id: string): Promise<RoleWithPermissionsEntity> {
    return this.roleRepository.findByIdWithPermissions(id);
  }

  create(dto: CreateRoleDto): Promise<RoleEntity> {
    return this.roleRepository.create({
      name: dto.name,
      description: dto.description,
    });
  }

  update(id: string, dto: UpdateRoleDto): Promise<RoleEntity> {
    return this.roleRepository.update(id, {
      name: dto.name,
      description: dto.description,
    });
  }

  remove(id: string): Promise<RoleEntity> {
    return this.roleRepository.remove(id);
  }

  getPermissions(roleId: string): Promise<RolePermissionEntity[]> {
    return this.rolePermissionService.getPermissionsByRoleId(roleId);
  }

  setPermissions(roleId: string, permissionIds: string[]): Promise<RolePermissionEntity[]> {
    return this.rolePermissionService.setPermissions(roleId, permissionIds);
  }
}