import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeyService } from '@app/libs/modules/api-key/api-key.service';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface AuthenticatedHeaders {
  'x-api-key'?: string | string[];
}

interface AuthenticatedApiKeyRequest {
  headers: AuthenticatedHeaders;
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedApiKeyRequest>();
    const header = request.headers['x-api-key'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (typeof raw === 'string' && raw.trim() !== '') {
      request.user = await this.apiKeyService.authenticate(raw.trim());
      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }
}
