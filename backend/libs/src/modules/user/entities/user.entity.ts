import { Prisma } from '@prisma/client';

export const userSelect = {
  id: true,
  email: true,
  fullName: true,
  status: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserEntity = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export const userWithPasswordSelect = {
  id: true,
  email: true,
  fullName: true,
  passwordHash: true,
  status: true,
  roleId: true,
} satisfies Prisma.UserSelect;

export type UserAuthEntity = Prisma.UserGetPayload<{ select: typeof userWithPasswordSelect }>;