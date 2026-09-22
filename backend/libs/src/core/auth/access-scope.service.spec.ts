import { ContentStatus, ContentVisibility } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { hasAdminAccess, ADMIN_ACCESS_PERMISSION } from '@app/libs/modules/permission/permission.constants';
import { AccessScopeService, ownReadWhere } from './access-scope.service';

function make(user: { organizationId?: string | null; codes?: string[] }): AccessScopeService {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        organizationId: user.organizationId ?? null,
        role: { permissions: (user.codes ?? []).map((code) => ({ permission: { code } })) },
      }),
    },
  };
  return new AccessScopeService(prisma as unknown as PrismaService);
}

describe('AccessScopeService.resolve (permission-based, per-resource)', () => {
  it('M6: moderator via reject/unpublish → all', async () => {
    await expect(make({ codes: ['event:reject'] }).resolve('u1', 'event')).resolves.toEqual({
      kind: 'all',
      canViewPrivate: true,
    });
    await expect(make({ codes: ['story:unpublish'] }).resolve('u1', 'story')).resolves.toEqual({
      kind: 'all',
      canViewPrivate: true,
    });
  });

  it('M2: story write does NOT grant organization scope on event', async () => {
    const svc = make({ organizationId: 'org-1', codes: ['story:create'] });
    await expect(svc.resolve('u1', 'event')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: true,
    });
    await expect(svc.resolve('u1', 'story')).resolves.toEqual({
      kind: 'organization',
      organizationId: 'org-1',
      userId: 'u1',
      canViewPrivate: true,
    });
  });

  it('organizationId + content write (event) → organization for event', async () => {
    await expect(
      make({ organizationId: 'org-1', codes: ['event:create'] }).resolve('u1', 'event'),
    ).resolves.toEqual({
      kind: 'organization',
      organizationId: 'org-1',
      userId: 'u1',
      canViewPrivate: true,
    });
  });

  it('content write without organizationId → own', async () => {
    await expect(make({ codes: ['story:create'] }).resolve('u1', 'story')).resolves.toEqual({
      kind: 'own',
      userId: 'u1',
      canViewPrivate: true,
    });
  });

  it('H1: read-only → published + !canViewPrivate', async () => {
    await expect(make({ codes: ['story:read', 'event:read'] }).resolve('u1', 'story')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: false,
    });
  });

  it('member-like (event writer with org) → canViewPrivate true', async () => {
    await expect(
      make({ organizationId: 'org-1', codes: ['story:read', 'event:read', 'event:create'] }).resolve('u1', 'event'),
    ).resolves.toMatchObject({ kind: 'organization', canViewPrivate: true });
  });

  it('no permission → published + !canViewPrivate (least privilege)', async () => {
    await expect(make({ codes: [] }).resolve('u1', 'event')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: false,
    });
  });

  it('C1: admin:access alone is NOT a content scope (no all)', async () => {
    await expect(make({ codes: [ADMIN_ACCESS_PERMISSION] }).resolve('u1', 'event')).resolves.toEqual({
      kind: 'published',
      canViewPrivate: false,
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
