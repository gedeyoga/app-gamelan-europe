import { Prisma } from '@prisma/client';

export const permissionSelect = {
  id: true,
  code: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PermissionSelect;

export type PermissionEntity = Prisma.PermissionGetPayload<{
  select: typeof permissionSelect;
}>;

export const permissionCodeSelect = {
  code: true,
} satisfies Prisma.PermissionSelect;

export type PermissionCodeEntity = Prisma.PermissionGetPayload<{
  select: typeof permissionCodeSelect;
}>;