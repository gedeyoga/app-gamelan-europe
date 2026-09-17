import { Module } from '@nestjs/common';
import { RolePermissionModule } from '@app/libs/modules/role-permissions/role-permission.module';
import { RoleRepository } from './role.repository';
import { RoleService } from './role.service';

@Module({
  imports: [RolePermissionModule],
  providers: [RoleRepository, RoleService],
  exports: [RoleRepository, RoleService],
})
export class RoleModule {}