-- Rename table (model Network)
ALTER TABLE "organizations" RENAME TO "networks";

-- Rename primary key constraint to Prisma default for "networks"
ALTER TABLE "networks" RENAME CONSTRAINT "organizations_pkey" TO "networks_pkey";

-- Network fields (folded in from the unapplied 20260929120000_add_network_fields migration)
ALTER TABLE "networks" ADD COLUMN "website" TEXT;
ALTER TABLE "networks" ADD COLUMN "contact" TEXT;
ALTER TABLE "networks" ADD COLUMN "social_media" JSONB;

-- Rename FK columns (User / Billing / Event)
ALTER TABLE "users" RENAME COLUMN "organization_id" TO "network_id";
ALTER TABLE "billings" RENAME COLUMN "organization_id" TO "network_id";
ALTER TABLE "events" RENAME COLUMN "organization_id" TO "network_id";

-- Rename indexes to Prisma default names
ALTER INDEX "users_organization_id_idx" RENAME TO "users_network_id_idx";
ALTER INDEX "billings_organization_id_idx" RENAME TO "billings_network_id_idx";
ALTER INDEX "events_organization_id_idx" RENAME TO "events_network_id_idx";

-- Rename foreign key constraints to Prisma default names
ALTER TABLE "users" RENAME CONSTRAINT "users_organization_id_fkey" TO "users_network_id_fkey";
ALTER TABLE "billings" RENAME CONSTRAINT "billings_organization_id_fkey" TO "billings_network_id_fkey";
ALTER TABLE "events" RENAME CONSTRAINT "events_organization_id_fkey" TO "events_network_id_fkey";

-- RBAC: rename permission codes (rows only; role_permissions/api_key_permissions reference permission_id)
UPDATE "permissions" SET "code" = 'network:create' WHERE "code" = 'organization:create';
UPDATE "permissions" SET "code" = 'network:read' WHERE "code" = 'organization:read';
UPDATE "permissions" SET "code" = 'network:update' WHERE "code" = 'organization:update';
UPDATE "permissions" SET "code" = 'network:delete' WHERE "code" = 'organization:delete';
