import { Prisma } from '@prisma/client';

// Single source of truth payload untuk view API key. `keyHash` sengaja TIDAK
// di-select — hash tidak pernah keluar dari repository.
export const apiKeySelect = {
  id: true,
  name: true,
  prefix: true,
  lastUsedAt: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  permissions: { select: { permission: { select: { code: true } } } },
} satisfies Prisma.ApiKeySelect;

export type ApiKeyPayload = Prisma.ApiKeyGetPayload<{ select: typeof apiKeySelect }>;

// `permissions` di-flatten jadi daftar code (`string[]`) agar FE langsung pakai.
export type ApiKeyEntity = Omit<ApiKeyPayload, 'permissions'> & { permissions: string[] };

export function mapApiKey(row: ApiKeyPayload): ApiKeyEntity {
  return { ...row, permissions: row.permissions.map((p) => p.permission.code) };
}

// Payload khusus autentikasi `x-api-key` (findByHash): tanpa keyHash.
export const apiKeyAuthSelect = {
  id: true,
  createdBy: true,
  creator: { select: { id: true, email: true, status: true } },
  permissions: { select: { permission: { select: { code: true } } } },
} satisfies Prisma.ApiKeySelect;

export type ApiKeyAuthPayload = Prisma.ApiKeyGetPayload<{ select: typeof apiKeyAuthSelect }>;
