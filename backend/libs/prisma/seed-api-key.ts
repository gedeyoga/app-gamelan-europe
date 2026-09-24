import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_PERMISSIONS } from './seed-data';

// ---------------------------------------------------------------------------
// Seeder API key (idempoten) — HANYA memperbarui API key yang SUDAH ADA.
// Tidak pernah membuat/meng-upsert API key maupun Permission.
// Tanpa env: daftar permission diambil dari FILE (seed-data.ts).
//
// Semua API key di DB akan di-replace permission-nya dengan daftar di file.
// Bila belum ada API key sama sekali -> dilewati (exit 0), bukan error.
// Kode permission yang tidak ada di DB -> error; jalankan `pnpm prisma:seed`
// lebih dulu (seeder ini tidak membuat Permission).
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

// Daftar permission API key — sumber: FILE, sesuaikan bila perlu.
// `admin:access` sengaja TIDAK disertakan (gerbang manajemen user/role); tambahkan manual bila memang perlu.
const API_KEY_PERMISSIONS: string[] = DEFAULT_PERMISSIONS.map((p) => p.code).filter(
  (code) => code !== 'admin:access',
);

async function main(): Promise<void> {
  const keys = await prisma.apiKey.findMany({ select: { id: true, name: true } });
  if (keys.length === 0) {
    console.log('api key: tidak ada di DB, dilewati');
    return;
  }

  // Resolve code -> id. Tidak membuat Permission; code hilang = error.
  const permissionCodes = [...new Set(API_KEY_PERMISSIONS)];
  const foundPermissions = await prisma.permission.findMany({
    where: { code: { in: permissionCodes } },
    select: { id: true, code: true },
  });
  const idByCode = new Map(foundPermissions.map((p) => [p.code, p.id]));
  const missing = permissionCodes.filter((code) => !idByCode.has(code));
  if (missing.length > 0) {
    throw new Error(`Permission code tidak ada di DB: ${missing.join(', ')}. Jalankan pnpm prisma:seed dulu.`);
  }
  const permissionIds = permissionCodes.map((code) => idByCode.get(code) as string);

  for (const key of keys) {
    await prisma.apiKey.update({
      where: { id: key.id },
      data: {
        permissions: {
          deleteMany: {},
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
    });
  }

  console.log(
    `api key: permissions replaced (${permissionIds.length} permissions, ${keys.length} key)`,
  );
  console.log('Seed API key selesai (idempoten).');
}

main()
  .catch((e: unknown) => {
    console.error('Seed API key gagal.');
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
