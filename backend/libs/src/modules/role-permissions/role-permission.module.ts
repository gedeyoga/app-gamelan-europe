import { Module } from '@nestjs/common';
import { RolePermissionRepository } from './role-permission.repository';
import { RolePermissionService } from './role-permission.service';

@Module({
  providers: [RolePermissionRepository, RolePermissionService],
  exports: [RolePermissionRepository, RolePermissionService],
})
export class RolePermissionModule {}