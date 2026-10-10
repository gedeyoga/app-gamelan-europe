import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hash as argon2Hash } from '@node-rs/argon2';
import { DEFAULT_PERMISSIONS } from './seed-data';

const prisma = new PrismaClient();

type DefaultRole = { name: string; description: string; permissions: string[] };

function toCode(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

// ---------------------------------------------------------------------------
// Sumber deklaratif permission dipindah ke seed-data.ts (RULES Bab 22).
// Role -> permission ADDITIVE (seeder tidak pernah mencabut relasi role lain).
// ---------------------------------------------------------------------------

// Permission set bersama `member` & `author` (keduanya identik).
const MEMBER_PERMISSION_CODES = ['story:read', 'story:create', 'story:update', 'story:submit', 'event:read', 'event:create', 'event:update', 'event:submit', 'event-type:read', 'city:create', 'category:read', 'archive:read', 'archive:create', 'archive:update', 'archive:submit'];

// Role default (idempoten, additive). `admin` = semua permission;
// `member` & `author` = mengelola event & story sendiri sampai REQUEST (bukan read-only), permission set sama.
const DEFAULT_ROLES: DefaultRole[] = [
  {
    name: 'admin',
    description: 'Admin dengan akses penuh RBAC',
    permissions: DEFAULT_PERMISSIONS.map((p) => p.code),
  },
  {
    name: 'member',
    description: 'Anggota jaringan — mengelola event & story sendiri (sampai REQUEST)',
    permissions: MEMBER_PERMISSION_CODES,
  },
  {
    name: 'author',
    description: 'Author — mengelola event & story sendiri (sampai REQUEST)',
    permissions: MEMBER_PERMISSION_CODES,
  },
];

// Role legacy yang sudah dihapus dari DEFAULT_ROLES (rename RBAC v2). Baris DB-nya
// dibersihkan targeted saat seeding; user yang masih memakainya → `roleId` NULL
// (relasi `User.role` `onDelete: SetNull`).
const LEGACY_ROLE_NAMES = ['organization'];

// Permission legacy fitur submission yang sudah dihapus (mis. digantikan `network:approve`/`network:reject`).
// Baris DB-nya dibersihkan targeted by code saat seeding; relasi `role_permissions`
// (dan `api_key_permissions`) ikut terhapus (FK `onDelete: Cascade`).
const LEGACY_PERMISSION_CODES = [
  'archive-submission:read',
  'archive-submission:approve',
  'archive-submission:reject',
  'event-submission:read',
  'event-submission:approve',
  'event-submission:reject',
  'story-submission:read',
  'story-submission:approve',
  'story-submission:reject',
  'network-submission:read',
  'network-submission:update',
  'network-submission:approve',
  'network-submission:reject',
];

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim();
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME?.trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function main(): Promise<void> {
  if (!ADMIN_EMAIL || !ADMIN_FULL_NAME || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL, ADMIN_FULL_NAME, dan ADMIN_PASSWORD wajib di-set sebelum seeding.');
  }

  const knownCodes = new Set(DEFAULT_PERMISSIONS.map((p) => p.code));
  for (const role of DEFAULT_ROLES) {
    for (const code of role.permissions) {
      if (!knownCodes.has(code)) {
        throw new Error(
          `Role "${role.name}" mereferensikan permission "${code}" yang tidak ada di DEFAULT_PERMISSIONS.`,
        );
      }
    }
  }

  // Re-hash tiap re-seed: password admin selalu di-reset dari env.
  const passwordHash = await argon2Hash(ADMIN_PASSWORD, {
    algorithm: 2, // argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Tanpa interactive transaction: seed idempoten/additive, partial failure aman di-rerun.
  const permissionIdByCode = new Map<string, string>();

  for (const perm of DEFAULT_PERMISSIONS) {
    const saved = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: { id: randomUUID(), code: perm.code, description: perm.description },
    });
    permissionIdByCode.set(saved.code, saved.id);
    console.log(`permission ${saved.code}: upserted`);
  }

  const roleIdByName = new Map<string, string>();

  for (const role of DEFAULT_ROLES) {
    const saved = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, code: toCode(role.name) },
      create: { id: randomUUID(), name: role.name, code: toCode(role.name), description: role.description },
    });
    roleIdByName.set(saved.name, saved.id);
    console.log(`role ${saved.name}: upserted`);
  }

  // ADDITIVE: susun seluruh relasi role -> permission, lalu insert sekali jalan.
  // skipDuplicates menjaga idempotensi (relasi yang sudah ada dilewati).
  const rolePermissionData: { roleId: string; permissionId: string }[] = [];
  for (const role of DEFAULT_ROLES) {
    const roleId = roleIdByName.get(role.name);
    if (!roleId) {
      throw new Error(`Role "${role.name}" tidak ditemukan setelah upsert.`);
    }
    for (const code of role.permissions) {
      const permissionId = permissionIdByCode.get(code);
      if (!permissionId) {
        throw new Error(`Permission "${code}" tidak ditemukan setelah upsert.`);
      }
      rolePermissionData.push({ roleId, permissionId });
    }
  }

  const createdRolePermissions = await prisma.rolePermission.createMany({
    data: rolePermissionData,
    skipDuplicates: true,
  });
  console.log(`role-permission: ${createdRolePermissions.count} relation(s) created (additive)`);

  // Hapus role legacy (mis. `organization` sebelum rename RBAC v2). Targeted by name —
  // bukan deleteMany global. Relasi `role_permissions` ikut terhapus (FK `onDelete: Cascade`);
  // user yang masih memakai role ini → `roleId` NULL (FK `onDelete: SetNull`).
  const removedLegacyRoles = await prisma.role.deleteMany({
    where: { name: { in: LEGACY_ROLE_NAMES } },
  });
  if (removedLegacyRoles.count > 0) {
    console.log(`role legacy: ${removedLegacyRoles.count} role(s) removed (${LEGACY_ROLE_NAMES.join(', ')})`);
  }

  // Hapus permission legacy submission (fitur sudah dihapus). Targeted by code — bukan
  // deleteMany global. Relasi `role_permissions`/`api_key_permissions` ikut terhapus
  // (FK `onDelete: Cascade`, lihat schema.prisma).
  const removedLegacyPermissions = await prisma.permission.deleteMany({
    where: { code: { in: LEGACY_PERMISSION_CODES } },
  });
  if (removedLegacyPermissions.count > 0) {
    console.log(
      `permission legacy: ${removedLegacyPermissions.count} permission(s) removed (${LEGACY_PERMISSION_CODES.join(', ')})`,
    );
  }

  const adminRoleId = roleIdByName.get('admin');
  if (!adminRoleId) {
    throw new Error('Role "admin" wajib ada di DEFAULT_ROLES.');
  }

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      fullName: ADMIN_FULL_NAME,
      passwordHash,
      roleId: adminRoleId,
    },
    create: {
      id: randomUUID(),
      email: ADMIN_EMAIL,
      fullName: ADMIN_FULL_NAME,
      passwordHash,
      roleId: adminRoleId,
      status: 'ACTIVE',
    },
  });
  console.log(`user ${ADMIN_EMAIL}: upserted (password di-reset)`);

  console.log('Seed RBAC selesai (idempoten, additive).');
}

main()
  .catch((e: unknown) => {
    console.error('Seed RBAC gagal.');
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
