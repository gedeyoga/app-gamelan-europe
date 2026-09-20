import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/libs/core/database/prisma.service';

// Role (role.code) yang boleh membaca konten ber-visibility PRIVATE.
export const PRIVATE_READER_ROLES = ['admin', 'member', 'organization'] as const;

// Scope akses konten per user (row-level scoping). Dipakai `scopeWhere`/`assertReadable`
// di event & post service.
// `canViewPrivate` independen dari `.kind`: role custom non-all/non-org tidak bocor.
export type AccessScope =
  | { kind: 'all'; canViewPrivate: boolean }
  | { kind: 'organization'; organizationId: string; userId: string; canViewPrivate: boolean }
  | { kind: 'published'; canViewPrivate: boolean }
  | { kind: 'none'; canViewPrivate: boolean };

@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<AccessScope> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, role: { select: { code: true } } },
    });
    const code = user?.role?.code;
    const canViewPrivate = (PRIVATE_READER_ROLES as readonly string[]).includes(code ?? '');
    if (code === 'admin') return { kind: 'all', canViewPrivate };
    if (code === 'organization') {
      return user?.organizationId
        ? { kind: 'organization', organizationId: user.organizationId, userId, canViewPrivate }
        : { kind: 'none', canViewPrivate };
    }
    // default least-privilege: role lain hanya konten PUBLISHED (PRIVATE hanya bila canViewPrivate)
    return { kind: 'published', canViewPrivate };
  }
}
