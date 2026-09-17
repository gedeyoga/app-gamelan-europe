import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'];
    const expected = this.config.get<string>('INTERNAL_API_SECRET');

    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    return true;
  }
}
