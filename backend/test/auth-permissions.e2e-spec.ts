/**
 * e2e: 401 vs 403 permission matrix (RULES bab 15 — e2e di test/).
 *
 * HTTP-level test with the real PermissionsGuard + real controllers and
 * mocked services (no DB/Redis needed). AuthN is simulated by MockJwtGuard,
 * which mirrors JwtAuthGuard semantics: @Public() bypasses, otherwise a
 * missing/invalid Authorization header yields 401 and the token subject
 * becomes request.user (token value = user id).
 *
 * Matrix:
 * - tanpa token → 401
 * - token tanpa permission → 403
 * - token dengan permission → 200
 * - logout/me dengan JWT apapun → lolos (LOGIN-only exception)
 */
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

// @nestjs/jwt ships ESM-only dist that the CJS jest transform cannot
// interop at runtime; stub it — this e2e never issues/verifies real JWTs
// (AuthN is simulated by MockJwtGuard below).
jest.mock(
  '@nestjs/jwt',
  () => ({
    JwtModule: { register: jest.fn(), registerAsync: jest.fn() },
    JwtService: jest.fn(),
  }),
  { virtual: true },
);

// @nestjs/passport v12 ships ESM-only dist; stub it — JwtAuthGuard /
// JwtStrategy are never instantiated in this e2e (MockJwtGuard below).
jest.mock(
  '@nestjs/passport',
  () => ({
    PassportModule: { register: jest.fn() },
    AuthGuard: () => class MockAuthGuard {},
    PassportStrategy: () => class MockPassportStrategy {},
  }),
  { virtual: true },
);

// @nestjs/mapped-types ships ESM-only helpers that the CJS jest transform
// cannot load; stub the type-helpers (only used as DTO base classes here).
jest.mock(
  '@nestjs/mapped-types',
  () => ({
    PartialType: (cls: new (...args: never[]) => unknown) => cls,
    PickType: (cls: new (...args: never[]) => unknown) => cls,
    OmitType: (cls: new (...args: never[]) => unknown) => cls,
    IntersectionType: () => class {},
  }),
  { virtual: true },
);
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, PermissionService, RoleService, UserService } from '@app/libs';
import type { AuthenticatedUser } from '@app/libs';
import { IS_PUBLIC_KEY } from '@app/libs';
import { PermissionsGuard } from '@app/libs';
import { HealthController } from '../apps/app/src/controllers/health.controller';
import { AuthController } from '../apps/app/src/controllers/auth.controller';
import { UsersController } from '../apps/app/src/controllers/users.controller';
import { RolesController } from '../apps/app/src/controllers/roles.controller';

interface MockRequest {
  headers: Record<string, string | undefined>;
  user?: AuthenticatedUser;
}

@Injectable()
class MockJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<MockRequest>();
    const header = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) throw new UnauthorizedException('Unauthorized');
    request.user = { id: token, email: `${token}@example.com`, jti: 'e2e-jti', exp: 9999999999 };
    return true;
  }
}

describe('auth permissions e2e (401 vs 403)', () => {
  let app: INestApplication;
  let baseUrl: string;

  const WITH_PERMISSION = 'user-with-permission';
  const WITHOUT_PERMISSION = 'user-without-permission';
  const ANY_USER = 'any-user';
  const WITH_ROLE_UPDATE_ONLY = 'user-with-role-update-only';
  const WITH_PERMISSION_UPDATE = 'user-with-permission-update';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController, AuthController, UsersController, RolesController],
      providers: [
        Reflector,
        {
          provide: UserService,
          useValue: {
            list: async () => ({ items: [], total: 0 }),
            findOne: async (id: string) => ({ id }),
          },
        },
        {
          provide: RoleService,
          useValue: {
            getPermissions: async (id: string) => ({ id, permissions: [] }),
            setPermissions: async (id: string) => ({ id, permissions: [] }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            logout: async () => ({ ok: true }),
            me: async (id: string) => ({ id }),
          },
        },
        {
          provide: PermissionService,
          useValue: {
            getPermissionCodesByUserId: async (userId: string): Promise<string[]> => {
              if (userId === WITH_PERMISSION) return ['user:read'];
              if (userId === WITH_ROLE_UPDATE_ONLY) return ['role:update'];
              if (userId === WITH_PERMISSION_UPDATE) return ['permission:update'];
              return [];
            },
          },
        },
        { provide: APP_GUARD, useClass: MockJwtGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  const get = (path: string, token?: string): Promise<Response> =>
    fetch(`${baseUrl}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  it('PUBLIC: GET /health tanpa token → 200', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
  });

  it('tanpa token → 401 (GET /users)', async () => {
    const res = await get('/users');
    expect(res.status).toBe(401);
  });

  it('token tanpa permission → 403 (GET /users)', async () => {
    const res = await get('/users', WITHOUT_PERMISSION);
    expect(res.status).toBe(403);
  });

  it('token dengan permission → 200 (GET /users)', async () => {
    const res = await get('/users', WITH_PERMISSION);
    expect(res.status).toBe(200);
  });

  it('LOGIN-only: GET /auth/me tanpa token → 401, dengan JWT apapun → 200', async () => {
    const anonymous = await get('/auth/me');
    expect(anonymous.status).toBe(401);

    const authenticated = await get('/auth/me', ANY_USER);
    expect(authenticated.status).toBe(200);
  });

  it('LOGIN-only: POST /auth/logout tanpa token → 401, dengan JWT apapun → lolos', async () => {
    const anonymous = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'dummy' }),
    });
    expect(anonymous.status).toBe(401);

    const authenticated = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ANY_USER}`,
      },
      body: JSON.stringify({ refreshToken: 'dummy' }),
    });
    expect([200, 201]).toContain(authenticated.status);
  });

  it('token dengan role:update saja → 403 (PUT /roles/:id/permissions butuh permission:update)', async () => {
    const res = await fetch(`${baseUrl}/roles/role-1/permissions`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${WITH_ROLE_UPDATE_ONLY}`,
      },
      body: JSON.stringify({ permissionIds: [] }),
    });
    expect(res.status).toBe(403);
  });

  it('token dengan permission:update → 200 (PUT /roles/:id/permissions)', async () => {
    const res = await fetch(`${baseUrl}/roles/role-1/permissions`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${WITH_PERMISSION_UPDATE}`,
      },
      body: JSON.stringify({ permissionIds: [] }),
    });
    expect(res.status).toBe(200);
  });
});
