import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { rolePermissionSelect, RolePermissionEntity } from './entities/role-permission.entity';

@Injectable()
export class RolePermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertRoleExists(roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) throw new NotFoundException('Role not found');
  }

  async findPermissionsByRoleId(roleId: string): Promise<RolePermissionEntity[]> {
    await this.assertRoleExists(roleId);
    return this.prisma.rolePermission.findMany({
      where: { roleId },
      select: rolePermissionSelect,
    });
  }

  async replacePermissions(roleId: string, permissionIds: string[]): Promise<RolePermissionEntity[]> {
    await this.assertRoleExists(roleId);

    const count = await this.prisma.permission.count({ where: { id: { in: permissionIds } } });
    if (count !== permissionIds.length) throw new NotFoundException('Permission not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      });
      return tx.rolePermission.findMany({ where: { roleId }, select: rolePermissionSelect });
    });
  }
}