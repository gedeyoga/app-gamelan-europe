import { Prisma } from '@prisma/client';

export const roleSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RoleSelect;

export type RoleEntity = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

export const roleWithPermissionsSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  permissions: { select: { permissionId: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RoleSelect;

export type RoleWithPermissionsEntity = Prisma.RoleGetPayload<{
  select: typeof roleWithPermissionsSelect;
}>;