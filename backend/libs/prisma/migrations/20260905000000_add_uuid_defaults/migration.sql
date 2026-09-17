-- Set DEFAULT gen_random_uuid() pada kolom id semua tabel.
-- Setelah migration ini, kolom `id` akan auto-generate UUIDv4 di level DB
-- (selaras dengan Prisma @default(uuid()) di schema.prisma).
-- Aman untuk data existing: hanya mengubah default, tidak menyentuh baris.
ALTER TABLE "users"           ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "roles"           ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "permissions"     ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "refresh_tokens"  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Normalisasi id existing non-UUID → UUID (idempotent: WHERE filter skip baris yang sudah UUID).
-- Urutan: roles/permissions (parent) → hapus dangling FK di role_permissions → users → refresh_tokens.

-- 1. Roles (parent untuk users & role_permissions)
UPDATE "roles"
SET "id" = gen_random_uuid()
WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2. Permissions (parent untuk role_permissions)
UPDATE "permissions"
SET "id" = gen_random_uuid()
WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Bersihkan role_permissions yang parent-nya sudah di-regenerate (FK dangling).
-- Setelah UPDATE roles/permissions, id lama di role_permissions jadi invalid.
-- Relasi N:M tidak punya "kebenaran" — tidak bisa otomatis reattach.
-- Solusi: hapus baris dangling; seeder akan re-create relasi via role-permission upsert.
DELETE FROM "role_permissions"
WHERE "role_id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR "permission_id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 3. Users (parent untuk refresh_tokens)
UPDATE "users"
SET "id" = gen_random_uuid()
WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 4. Refresh tokens (child dari users) — regenerate supaya konsisten jika parent berubah
UPDATE "refresh_tokens"
SET "id" = gen_random_uuid()
WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';