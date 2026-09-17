import { Prisma } from '@prisma/client';

export const rolePermissionSelect = {
  roleId: true,
  permissionId: true,
  permission: { select: { id: true, code: true, description: true } },
} satisfies Prisma.RolePermissionSelect;

export type RolePermissionEntity = Prisma.RolePermissionGetPayload<{
  select: typeof rolePermissionSelect;
}>;