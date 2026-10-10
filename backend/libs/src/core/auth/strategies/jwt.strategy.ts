import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CacheService } from '@app/libs/core/redis/cache.service';
import { BillingService } from '@app/libs/modules/billing/billing.service';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  jti: string;
  exp: number;
  // Membership aktif user (billing PAID belum kedaluwarsa); fresh per request.
  isMember: boolean;
  // Diisi hanya untuk principal dari `x-api-key` (bukan JWT).
  apiKeyId?: string;
  permissions?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly cache: CacheService,
    private readonly billingService: BillingService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const blacklisted = await this.cache.get(`jwt:blacklist:${payload.jti}`);
    if (blacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return {
      id: payload.sub,
      email: payload.email,
      jti: payload.jti,
      exp: payload.exp ?? 0,
      isMember: await this.billingService.hasActiveMembership(payload.sub),
    };
  }
}