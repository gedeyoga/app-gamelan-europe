import { Module } from '@nestjs/common';
import { PermissionRepository } from './permission.repository';
import { PermissionService } from './permission.service';

@Module({
  providers: [PermissionRepository, PermissionService],
  exports: [PermissionRepository, PermissionService],
})
export class PermissionModule {}