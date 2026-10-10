import { ContentStatus, ContentVisibility } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import type { BillingService } from '@app/libs/modules/billing/billing.service';
import { hasAdminAccess, ADMIN_ACCESS_PERMISSION } from '@app/libs/modules/permission/permission.constants';
import { AccessScopeService, ownReadWhere } from './access-scope.service';

function make(user: { networkId?: string | null; codes?: string[]; isMember?: boolean }): AccessScopeService {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        networkId: user.networkId ?? null,
        role: { permissions: (user.codes ?? []).map((code) => ({ permission: { code } })) },
      }),
    },
  };
  const billing = { hasActiveMembership: jest.fn().mockResolvedValue(user.isMember ?? false) };
  return new AccessScopeService(prisma as unknown as PrismaService, billing as unknown as BillingService);
}

describe('AccessScopeService.resolve (permission-based, per-resource)', () => {
  it('M6: moderator via reject/unpublish → all', async () => {
    await expect(make({ codes: ['event:reject'] }).resolve('u1', 'event')).resolves.toEqual({
      kind: 'all',
      canViewPrivate: true,
      isMember: false,
    });
    await expect(make({ codes: ['story:unpublish'] }).resolve('u1', 'story')).resolves.toEqual({
      kind: 'all',
      canViewPrivate: true,
      isMember: false,
    });
  });

  it('M2: story write does NOT grant network scope on event', async () => {
    const svc = make({ networkId: 'org-1', codes: ['story:create'] });
    await expect(svc.resolve('u1', 'event')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: true,
      isMember: false,
    });
    await expect(svc.resolve('u1', 'story')).resolves.toEqual({
      kind: 'network',
      networkId: 'org-1',
      userId: 'u1',
      canViewPrivate: true,
      isMember: false,
    });
  });

  it('networkId + content write (event) → network for event', async () => {
    await expect(
      make({ networkId: 'org-1', codes: ['event:create'] }).resolve('u1', 'event'),
    ).resolves.toEqual({
      kind: 'network',
      networkId: 'org-1',
      userId: 'u1',
      canViewPrivate: true,
      isMember: false,
    });
  });

  it('content write without networkId → own', async () => {
    await expect(make({ codes: ['story:create'] }).resolve('u1', 'story')).resolves.toEqual({
      kind: 'own',
      userId: 'u1',
      canViewPrivate: true,
      isMember: false,
    });
  });

  it('H1: read-only → published + !canViewPrivate', async () => {
    await expect(make({ codes: ['story:read', 'event:read'] }).resolve('u1', 'story')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: false,
      isMember: false,
    });
  });

  it('member-like (event writer with org) → canViewPrivate true', async () => {
    await expect(
      make({ networkId: 'org-1', codes: ['story:read', 'event:read', 'event:create'] }).resolve('u1', 'event'),
    ).resolves.toMatchObject({ kind: 'network', canViewPrivate: true, isMember: false });
  });

  it('no permission → published + !canViewPrivate (least privilege)', async () => {
    await expect(make({ codes: [] }).resolve('u1', 'event')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: false,
      isMember: false,
    });
  });

  it('C1: admin:access alone is NOT a content scope (no all)', async () => {
    await expect(make({ codes: [ADMIN_ACCESS_PERMISSION] }).resolve('u1', 'event')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: false,
      isMember: false,
    });
  });

  it('active member tanpa write permission → published + isMember true (PRIVATE/MEMBER readable)', async () => {
    await expect(make({ codes: ['story:read'], isMember: true }).resolve('u1', 'story')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: false,
      isMember: true,
    });
  });

  it('non-member inactive tanpa write permission → isMember false (tidak bisa baca PRIVATE)', async () => {
    await expect(make({ codes: ['story:read'], isMember: false }).resolve('u1', 'story')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: false,
      isMember: false,
    });
  });
});

describe('hasAdminAccess (C1: explicit user/role gate)', () => {
  it('content moderator + user:create is NOT admin', () => {
    expect(hasAdminAccess(['event:publish', 'user:create'])).toBe(false);
  });

  it('admin:access → admin', () => {
    expect(hasAdminAccess([ADMIN_ACCESS_PERMISSION])).toBe(true);
  });
});

describe('ownReadWhere (M5: own reads owned OR published)', () => {
  it('OR of createdBy + published-visible', () => {
    const where = ownReadWhere('u1', true) as {
      OR: [Record<string, unknown>, Record<string, unknown>];
    };
    expect(where.OR[0]).toEqual({ createdBy: 'u1' });
    expect(where.OR[1]).toMatchObject({ status: ContentStatus.PUBLISHED });
    expect(where.OR[1].visibility).toBeUndefined();
  });

  it('non-reader adds visibility PUBLIC', () => {
    const where = ownReadWhere('u1', false) as { OR: [unknown, Record<string, unknown>] };
    expect(where.OR[1]).toMatchObject({ status: ContentStatus.PUBLISHED, visibility: ContentVisibility.PUBLIC });
  });
});
