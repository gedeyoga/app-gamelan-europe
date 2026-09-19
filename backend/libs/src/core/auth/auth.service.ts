import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';
import { CacheService } from '@app/libs/core/redis/cache.service';
import { UserService } from '@app/libs/modules/user/user.service';
import { UserRepository } from '@app/libs/modules/user/user.repository';
import { PermissionService } from '@app/libs/modules/permission/permission.service';
import { RegisterUserDto } from '@app/libs/modules/user/dto/register-user.dto';
import { LoginDto } from '@app/libs/modules/user/dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { parseDurationToSeconds, sha256 } from './helpers/auth.util';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { UserEntity } from '@app/libs/modules/user/entities/user.entity';
import { RefreshTokenRepository } from './refresh-token.repository';

export interface AuthUserEntity {
  accessToken: string;
  refreshToken: string;
  user: UserEntity;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,
    private readonly permissionService: PermissionService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  register(dto: RegisterUserDto) {
    return this.userService.register(dto);
  }

  async login(dto: LoginDto): Promise<AuthUserEntity> {
    const user = await this.userRepository.findByEmailWithPassword(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2Verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid credentials');

    const accessToken = await this.signAccessToken(user.id, user.email);
    const refreshToken = await this.issueRefreshToken(user.id);
    const profile = await this.userRepository.findById(user.id);

    return { accessToken, refreshToken, user: profile };
  }

  async refresh(dto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = sha256(dto.refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHashWithUser(tokenHash);

    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.revokedAt) {
      await this.refreshTokenRepository.revokeFamily(stored.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token expired');
    if (stored.user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid refresh token');

    const claimed = await this.refreshTokenRepository.claim(tokenHash);
    if (!claimed) {
      await this.refreshTokenRepository.revokeFamily(stored.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const newToken = randomBytes(48).toString('hex');
    const expiresIn = parseDurationToSeconds(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'));
    const created = await this.refreshTokenRepository.create({
      userId: stored.userId,
      tokenHash: sha256(newToken),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    });
    await this.refreshTokenRepository.markReplaced(stored.id, created.id);

    const accessToken = await this.signAccessToken(stored.userId, stored.user.email);
    return { accessToken, refreshToken: newToken };
  }

  async logout(user: AuthenticatedUser, refreshToken?: string): Promise<null> {
    if (user.jti) {
      const ttlSeconds = Math.max(Math.floor(user.exp - Date.now() / 1000), 1);
      await this.cache.set(`jwt:blacklist:${user.jti}`, '1', ttlSeconds);
    }
    if (refreshToken) {
      const tokenHash = sha256(refreshToken);
      await this.refreshTokenRepository.revokeByTokenHash(tokenHash);
    }
    return null;
  }

  async me(userId: string) {
    const user = await this.userRepository.findById(userId);
    const permissions = await this.permissionService.getPermissionCodesByUserId(userId);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      role: user.role,
      countryId: user.countryId,
      country: user.country,
      permissions,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.fullName === undefined && dto.email === undefined && dto.countryId === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }
    if (dto.email !== undefined && dto.email !== '') {
      const existing = await this.userRepository.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
    }
    const data: { fullName?: string; email?: string; countryId?: string } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.countryId !== undefined) data.countryId = dto.countryId;
    await this.userRepository.update(userId, data);
    return this.me(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<null> {
    const user = await this.userRepository.findByIdWithPassword(userId);
    if (!user) throw new UnauthorizedException('Current password is incorrect');

    const valid = await argon2Verify(user.passwordHash, dto.currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const passwordHash = await argon2Hash(dto.newPassword, {
      algorithm: 2,
      memoryCost: Number(this.config.get('ARGON2_MEMORY_COST', '65536')),
      timeCost: Number(this.config.get('ARGON2_TIME_COST', '3')),
      parallelism: Number(this.config.get('ARGON2_PARALLELISM', '4')),
    });
    await this.userRepository.update(userId, { passwordHash });
    await this.refreshTokenRepository.revokeFamily(userId);
    return null;
  }

  private async signAccessToken(userId: string, email: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email, jti: randomUUID() },
      { expiresIn: this.config.get('JWT_EXPIRES_IN', '15m') },
    );
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(48).toString('hex');
    const expiresIn = parseDurationToSeconds(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'));
    await this.refreshTokenRepository.create({
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    });
    return token;
  }
}