import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '@app/libs/modules/permission/permission.service';
import type { AuthenticatedUser } from '@app/libs/core/auth/strategies/jwt.strategy';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PermissionsGuard } from './permissions.guard';

const authenticatedUser = (id: string): AuthenticatedUser => ({
  id,
  email: `${id}@example.com`,
  jti: 'test-jti',
  exp: 9999999999,
});

const apiKeyUser = (permissions: string[]): AuthenticatedUser => ({
  id: 'creator-id',
  email: 'creator@example.com',
  jti: '',
  exp: 0,
  apiKeyId: 'api-key-id',
  permissions,
});

describe('PermissionsGuard (deny-by-default)', () => {
  let guard: PermissionsGuard;
  let reflectorGetAll: jest.Mock;
  let getPermissionCodesByUserId: jest.Mock;

  const buildContext = (user?: AuthenticatedUser): ExecutionContext => {
    function handler(): void {}
    class TestController {}
    return {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  };

  const mockMetadata = (isPublic?: boolean, required?: string[]): void => {
    reflectorGetAll.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return isPublic;
      if (key === PERMISSIONS_KEY) return required;
      return undefined;
    });
  };

  beforeEach(() => {
    reflectorGetAll = jest.fn();
    getPermissionCodesByUserId = jest.fn();
    guard = new PermissionsGuard(
      { getAllAndOverride: reflectorGetAll } as unknown as Reflector,
      { getPermissionCodesByUserId } as unknown as PermissionService,
    );
  });

  it('PUBLIC route passes without user and without loading permissions', async () => {
    mockMetadata(true, undefined);
    await expect(guard.canActivate(buildContext(undefined))).resolves.toBe(true);
    expect(getPermissionCodesByUserId).not.toHaveBeenCalled();
  });

  it('missing @Permissions metadata without user → 403 Permission required (deny-by-default)', async () => {
    mockMetadata(false, undefined);
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      new ForbiddenException('Permission required'),
    );
    expect(getPermissionCodesByUserId).not.toHaveBeenCalled();
  });

  it('empty @Permissions metadata without user → 403 Permission required', async () => {
    mockMetadata(false, []);
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      new ForbiddenException('Permission required'),
    );
  });

  it('LOGIN-only exception (e.g. logout/me): authenticated user passes without permission codes', async () => {
    mockMetadata(false, undefined);
    getPermissionCodesByUserId.mockResolvedValue([]);
    await expect(
      guard.canActivate(buildContext(authenticatedUser('any-user-id'))),
    ).resolves.toBe(true);
    expect(getPermissionCodesByUserId).not.toHaveBeenCalled();
  });

  it('route with @Permissions but without user → 401', async () => {
    mockMetadata(false, ['user:read']);
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      new UnauthorizedException('Unauthorized'),
    );
    expect(getPermissionCodesByUserId).not.toHaveBeenCalled();
  });

  it('authenticated user without the required code → 403 Forbidden resource', async () => {
    mockMetadata(false, ['user:read']);
    getPermissionCodesByUserId.mockResolvedValue(['role:read']);
    await expect(
      guard.canActivate(buildContext(authenticatedUser('user-1'))),
    ).rejects.toThrow(new ForbiddenException('Forbidden resource'));
    expect(getPermissionCodesByUserId).toHaveBeenCalledWith('user-1');
  });

  it('authenticated user with one matching code → allowed (fresh codes from DB)', async () => {
    mockMetadata(false, ['user:read', 'user:update']);
    getPermissionCodesByUserId.mockResolvedValue(['user:update']);
    await expect(
      guard.canActivate(buildContext(authenticatedUser('user-2'))),
    ).resolves.toBe(true);
    expect(getPermissionCodesByUserId).toHaveBeenCalledWith('user-2');
  });

  it('API key principal without @Permissions metadata → 403 Permission required (no LOGIN-only exception)', async () => {
    mockMetadata(false, undefined);
    await expect(guard.canActivate(buildContext(apiKeyUser(['user:read'])))).rejects.toThrow(
      new ForbiddenException('Permission required'),
    );
    expect(getPermissionCodesByUserId).not.toHaveBeenCalled();
  });

  it('API key principal with matching permission → allowed, uses embedded permissions (no DB call)', async () => {
    mockMetadata(false, ['user:read']);
    await expect(guard.canActivate(buildContext(apiKeyUser(['user:read'])))).resolves.toBe(true);
    expect(getPermissionCodesByUserId).not.toHaveBeenCalled();
  });

  it('API key principal without the required code → 403 Forbidden resource', async () => {
    mockMetadata(false, ['user:read']);
    await expect(guard.canActivate(buildContext(apiKeyUser(['role:read'])))).rejects.toThrow(
      new ForbiddenException('Forbidden resource'),
    );
    expect(getPermissionCodesByUserId).not.toHaveBeenCalled();
  });
});
