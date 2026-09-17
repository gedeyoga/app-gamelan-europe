import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';

const refreshTokenWithUserSelect = {
  id: true,
  userId: true,
  tokenHash: true,
  expiresAt: true,
  revokedAt: true,
  user: { select: { id: true, email: true, status: true } },
} satisfies Prisma.RefreshTokenSelect;

export type RefreshTokenWithUser = Prisma.RefreshTokenGetPayload<{
  select: typeof refreshTokenWithUserSelect;
}>;

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRefreshTokenData): Promise<{ id: string }> {
    return this.prisma.refreshToken.create({ data, select: { id: true } });
  }

  findByTokenHashWithUser(tokenHash: string): Promise<RefreshTokenWithUser | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: refreshTokenWithUserSelect,
    });
  }

  async claim(tokenHash: string): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }

  revokeFamily(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeByTokenHash(tokenHash: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  markReplaced(id: string, replacedByTokenId: string): Promise<{ id: string }> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { replacedByTokenId },
      select: { id: true },
    });
  }
}