import { Injectable } from '@nestjs/common';
import { ContentStatus, ContentVisibility } from '@prisma/client';
import { PrismaService } from '@app/libs/core/database/prisma.service';
import { BillingService } from '@app/libs/modules/billing/billing.service';

// Sumber tunggal penentuan scope konten. SEMUA berbasis `permission.code` + `networkId`
// — TIDAK ada cek `role.code`/nama role (role boleh custom) dan TIDAK ada permission khusus admin.
export type ContentResource = 'story' | 'event' | 'archive';
export const CONTENT_RESOURCES = ['story', 'event', 'archive'] as const;

// Action status-manager/moderator konten (approve/publish/reject/unpublish) → scope `all`.
export const CONTENT_MODERATOR_ACTIONS = ['approve', 'publish', 'reject', 'unpublish'] as const;
// Action tulis konten (create/update/submit) → penanda "pengelola konten".
export const CONTENT_WRITE_ACTIONS = ['create', 'update', 'submit'] as const;
// Action yang boleh menerbitkan langsung. Dipakai `PATCH /<domain>/:id` (status/publishedAt):
// scope `all` saja TIDAK cukup — `reject`/`unpublish` juga memberikannya.
export const CONTENT_PUBLISH_ACTIONS = ['approve', 'publish'] as const;

function hasActions(
  codes: readonly string[],
  resource: ContentResource,
  actions: readonly string[],
): boolean {
  return actions.some((action) => codes.includes(`${resource}:${action}`));
}

// Terbit langsung (via update/patch) wajib `*:approve` ATAU `*:publish`.
export function canPublishFromCodes(codes: readonly string[], resource: ContentResource): boolean {
  return hasActions(codes, resource, CONTENT_PUBLISH_ACTIONS);
}

// canViewPrivate: HANYA content manager / status-manager (punya permission tulis/status konten),
// BUKAN sekadar `*:read`. Admin/member/network lama punya tulis konten → tetap true.
export function canViewPrivateFromCodes(codes: readonly string[]): boolean {
  return CONTENT_RESOURCES.some(
    (resource) =>
      hasActions(codes, resource, CONTENT_WRITE_ACTIONS) ||
      hasActions(codes, resource, CONTENT_MODERATOR_ACTIONS),
  );
}

// Baca scope `own`: konten miliknya SENDIRI (`createdBy`) ATAU konten yang sudah terbit (public
// reading). Tulis tetap dibatasi pemilik (lihat `assertWritable`).
export function ownReadWhere(userId: string, canViewPrivate: boolean): Record<string, unknown> {
  const published: Record<string, unknown> = {
    status: ContentStatus.PUBLISHED,
    publishedAt: { not: null, lte: new Date() },
  };
  return {
    OR: [
      { createdBy: userId },
      canViewPrivate ? published : { ...published, visibility: ContentVisibility.PUBLIC },
    ],
  };
}

// Scope akses konten per user (row-level scoping). Dipakai `scopeWhere`/`assertReadable`
// di event & post service.
// `canViewPrivate` independen dari `.kind` (dihitung dari permission tulis/status konten).
// `isMember` independen dari `.kind` (membership billing aktif: PAID + belum kedaluwarsa).
// Baca PRIVATE/MEMBER diizinkan bila `canViewPrivate || isMember`.
export type AccessScope =
  | { kind: 'all'; canViewPrivate: boolean; isMember: boolean }
  | { kind: 'network'; networkId: string; userId: string; canViewPrivate: boolean; isMember: boolean }
  | { kind: 'own'; userId: string; canViewPrivate: boolean; isMember: boolean }
  | { kind: 'published'; canViewPrivate: boolean; isMember: boolean }
  | { kind: 'none'; canViewPrivate: boolean; isMember: boolean };

@Injectable()
export class AccessScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  // `resource` = domain konten yang sedang diakses: permission dihitung per-resource
  // (mis. `story:create` tidak memberi scope `network` untuk event).
  async resolve(userId: string, resource: ContentResource): Promise<AccessScope> {
    const [user, isMember] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          networkId: true,
          role: { select: { permissions: { select: { permission: { select: { code: true } } } } } },
        },
      }),
      this.billingService.hasActiveMembership(userId),
    ]);

    const codes = user?.role?.permissions.map((link) => link.permission.code) ?? [];
    const canViewPrivate = canViewPrivateFromCodes(codes);
    const isWriter = hasActions(codes, resource, CONTENT_WRITE_ACTIONS);

    if (hasActions(codes, resource, CONTENT_MODERATOR_ACTIONS)) {
      return { kind: 'all', canViewPrivate, isMember };
    }
    // Pengelola konten milik network-nya (butuh networkId + permission tulis resource ini).
    if (user?.networkId && isWriter) {
      return { kind: 'network', networkId: user.networkId, userId, canViewPrivate, isMember };
    }
    // Pengelola konten tanpa organisasi → scope konten miliknya (`createdBy = userId`).
    if (isWriter) return { kind: 'own', userId, canViewPrivate, isMember };
    // Least privilege: selain itu hanya konten PUBLISHED (PRIVATE/MEMBER hanya bila
    // `canViewPrivate` atau membership aktif).
    return { kind: 'published', canViewPrivate, isMember };
  }
}
