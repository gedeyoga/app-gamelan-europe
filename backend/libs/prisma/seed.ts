import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hash as argon2Hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

type DefaultPermission = { code: string; description: string };
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
// Sumber deklaratif tunggal seed RBAC (lihat RULES Bab 22 + rbac.md §7).
// - Tambah resource baru: tambah { code, description } di DEFAULT_PERMISSIONS
//   (format lowercase `resource:action`) + cantumkan code-nya di permissions
//   role yang relevan, lalu `pnpm prisma:seed`.
// - Tambah role baru: push { name, description, permissions } ke DEFAULT_ROLES.
//   Relasi role -> permission bersifat ADDITIVE (hanya upsert yang kurang), KECUALI
//   daftar ORGANIZATION_REMOVED_PERMISSION_CODES yang di-delete targeted dari role
//   `organization` saja (lihat konstanta di bawah).
// ---------------------------------------------------------------------------
const DEFAULT_PERMISSIONS: DefaultPermission[] = [
  { code: 'user:create', description: 'Membuat user baru' },
  { code: 'user:read', description: 'Melihat daftar/detail user' },
  { code: 'user:update', description: 'Mengubah user / role user' },
  { code: 'user:delete', description: 'Menghapus user' },
  { code: 'role:create', description: 'Membuat role baru' },
  { code: 'role:read', description: 'Melihat daftar/detail role' },
  { code: 'role:update', description: 'Mengubah role' },
  { code: 'role:delete', description: 'Menghapus role' },
  { code: 'permission:create', description: 'Membuat permission baru' },
  { code: 'permission:read', description: 'Melihat daftar/detail permission' },
  { code: 'permission:update', description: 'Mengubah permission / relasi role-permission' },
  { code: 'permission:delete', description: 'Menghapus permission' },
  { code: 'story:create', description: 'Membuat story baru' },
  { code: 'story:read', description: 'Melihat daftar/detail story' },
  { code: 'story:update', description: 'Mengubah story' },
  { code: 'story:delete', description: 'Menghapus story' },
  { code: 'story:submit', description: 'Mengajukan story untuk review (DRAFT -> REQUEST)' },
  { code: 'story:approve', description: 'Menyetujui & menerbitkan story (REQUEST -> PUBLISHED)' },
  { code: 'story:reject', description: 'Menolak story (REQUEST -> DRAFT)' },
  { code: 'story:publish', description: 'Menerbitkan story (APPROVED -> PUBLISHED)' },
  { code: 'story:unpublish', description: 'Menarik story dari publikasi (PUBLISHED -> DRAFT)' },
  { code: 'category:create', description: 'Membuat kategori baru' },
  { code: 'category:read', description: 'Melihat daftar/detail kategori' },
  { code: 'category:update', description: 'Mengubah kategori' },
  { code: 'category:delete', description: 'Menghapus kategori' },
  { code: 'event:create', description: 'Membuat event baru' },
  { code: 'event:read', description: 'Melihat daftar/detail event' },
  { code: 'event:update', description: 'Mengubah event' },
  { code: 'event:delete', description: 'Menghapus event' },
  { code: 'event:submit', description: 'Mengajukan event untuk review (DRAFT -> REQUEST)' },
  { code: 'event:approve', description: 'Menyetujui & menerbitkan event (REQUEST -> PUBLISHED)' },
  { code: 'event:reject', description: 'Menolak event (REQUEST -> DRAFT)' },
  { code: 'event:publish', description: 'Menerbitkan event (APPROVED -> PUBLISHED)' },
  { code: 'event:unpublish', description: 'Menarik event dari publikasi (PUBLISHED -> DRAFT)' },
  { code: 'event-type:create', description: 'Membuat tipe event baru' },
  { code: 'event-type:read', description: 'Melihat daftar/detail tipe event' },
  { code: 'organization:create', description: 'Membuat organization baru' },
  { code: 'organization:read', description: 'Melihat daftar/detail organization' },
  { code: 'organization:update', description: 'Mengubah organization' },
  { code: 'organization:delete', description: 'Menghapus organization' },
  { code: 'subscription:create', description: 'Membuat subscription baru' },
  { code: 'subscription:read', description: 'Melihat daftar/detail subscription' },
  { code: 'subscription:update', description: 'Mengubah subscription' },
  { code: 'subscription:delete', description: 'Menghapus subscription' },
  { code: 'billing:create', description: 'Membuat billing baru' },
  { code: 'billing:read', description: 'Melihat daftar/detail billing' },
  { code: 'billing:update', description: 'Mengubah billing' },
  { code: 'billing:delete', description: 'Menghapus billing' },
  { code: 'apikey:create', description: 'Membuat API key baru' },
  { code: 'apikey:read', description: 'Melihat daftar/detail API key' },
  { code: 'apikey:update', description: 'Mengubah nama/permission API key' },
  { code: 'apikey:delete', description: 'Menghapus API key' },
  { code: 'archive:create', description: 'Membuat archive' },
  { code: 'archive:read', description: 'Melihat daftar/detail archive' },
  { code: 'archive:update', description: 'Mengubah archive' },
  { code: 'archive:delete', description: 'Menghapus archive' },
  { code: 'archive:submit', description: 'Mengajukan archive untuk review (DRAFT -> REQUEST)' },
  { code: 'archive:approve', description: 'Menyetujui & menerbitkan archive (REQUEST -> PUBLISHED)' },
  { code: 'archive:reject', description: 'Menolak archive (REQUEST -> DRAFT)' },
  { code: 'archive:publish', description: 'Menerbitkan archive (APPROVED -> PUBLISHED)' },
  { code: 'archive:unpublish', description: 'Menarik archive dari publikasi (PUBLISHED -> DRAFT)' },
  // Gerbang manajemen user/role — HANYA role `admin` (dipetakan otomatis dari DEFAULT_PERMISSIONS).
  { code: 'admin:access', description: 'Akses penuh manajemen user/role (admin)' },
];

// Role default (idempoten, additive). `admin` = semua permission;
// `organization` = pengelola event milik anggota organisasinya (transisi maksimal sampai REQUEST);
// `member` = mengelola event sendiri sampai REQUEST (bukan read-only).
const DEFAULT_ROLES: DefaultRole[] = [
  {
    name: 'admin',
    description: 'Admin dengan akses penuh RBAC',
    permissions: DEFAULT_PERMISSIONS.map((p) => p.code),
  },
  {
    name: 'organization',
    description: 'Pengelola event milik anggota organisasinya (tanpa story write)',
    permissions: [
      'story:read',
      'event:create',
      'event:read',
      'event:update',
      'event:delete',
      'event:submit',
      'event-type:read',
      'category:read',
      'archive:create',
      'archive:read',
      'archive:update',
      'archive:delete',
      'archive:submit',
      'user:create',
      'user:read',
    ],
  },
  {
    name: 'member',
    description: 'Anggota organisasi — mengelola event (sampai REQUEST), tanpa story write',
    permissions: ['story:read', 'event:read', 'event:create', 'event:update', 'event:submit', 'event-type:read', 'category:read', 'archive:read', 'archive:create', 'archive:update', 'archive:submit'],
  },
];

// Relasi role-permission yang SENGAJA dihapus dari role `organization` (seeder otherwise
// additive). Targeted: hanya role `organization`, tidak menyentuh custom role / relasi lain.
// `story:read` TIDAK dihapus (lihat DEFAULT_ROLES).
const ORGANIZATION_REMOVED_PERMISSION_CODES = ['story:create', 'story:update', 'story:delete', 'story:submit'];

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

  // Targeted delete: copot story-write dari role `organization` (bukan deleteMany global —
  // custom role & relasi role lain tidak tersentuh). Perubahan permission yang di-*tambah*
  // tetap additive lewat createMany di atas.
  const organizationRoleId = roleIdByName.get('organization');
  if (organizationRoleId) {
    const removed = await prisma.rolePermission.deleteMany({
      where: {
        roleId: organizationRoleId,
        permission: { code: { in: ORGANIZATION_REMOVED_PERMISSION_CODES } },
      },
    });
    console.log(
      `role-permission organization -> removed ${removed.count} story-write relation(s): targeted`,
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
