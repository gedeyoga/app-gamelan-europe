import { Injectable } from '@nestjs/common';
import { RolePermissionRepository } from './role-permission.repository';
import { RolePermissionEntity } from './entities/role-permission.entity';

@Injectable()
export class RolePermissionService {
  constructor(private readonly rolePermissionRepository: RolePermissionRepository) {}

  getPermissionsByRoleId(roleId: string): Promise<RolePermissionEntity[]> {
    return this.rolePermissionRepository.findPermissionsByRoleId(roleId);
  }

  setPermissions(roleId: string, permissionIds: string[]): Promise<RolePermissionEntity[]> {
    return this.rolePermissionRepository.replacePermissions(roleId, permissionIds);
  }
}