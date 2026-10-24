import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '@app/libs/modules/permission/permission.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const targetClass = context.getClass();

    // PUBLIC routes (e.g. /health, /auth/login) skip permission checks entirely.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      handler,
      targetClass,
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      handler,
      targetClass,
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // Deny-by-default: every non-public route must declare @Permissions(...).
    // Missing metadata means a forgotten decorator — warn loudly so it is
    // caught in logs/review. LOGIN-only exception (e.g. POST /auth/logout,
    // GET /auth/me): any authenticated user may pass without a specific code.
    if (!required || required.length === 0) {
      this.logger.warn(
        `Missing @Permissions metadata on ${targetClass.name}.${handler.name} — Permission required`,
      );
      // API key tidak boleh menikmati LOGIN-only exception: butuh @Permissions eksplisit.
      if (!user?.id || user.apiKeyId) {
        throw new ForbiddenException('Permission required');
      }
      return true;
    }

    if (!user?.id) {
      throw new UnauthorizedException('Unauthorized');
    }

    // Principal API key membawa permission-nya sendiri; JWT load fresh dari DB lalu ditempel
    // ke `request.user` agar controller/service bisa membacanya tanpa query ulang di request yang sama.
    if (!user.permissions) {
      user.permissions = await this.permissionService.getPermissionCodesByUserId(user.id);
    }
    const codes = user.permissions;
    const allowed = required.some((code) => codes.includes(code));
    if (!allowed) throw new ForbiddenException('Forbidden resource');
    return true;
  }
}
