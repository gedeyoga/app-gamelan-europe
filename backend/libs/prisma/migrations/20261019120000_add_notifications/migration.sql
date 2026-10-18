-- Archive.slug (prasyarat link email /archives/{slug}): backfill unik dari name + suffix numerik.
ALTER TABLE "archives" ADD COLUMN "slug" TEXT;

DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  CREATE TEMP TABLE "_used_archive_slug" (slug TEXT PRIMARY KEY) ON COMMIT DROP;
  FOR r IN SELECT id, name FROM "archives" ORDER BY created_at, id LOOP
    base := lower(trim(both '-' from regexp_replace(coalesce(r.name, ''), '[^a-zA-Z0-9]+', '-', 'g')));
    IF base = '' THEN
      base := 'archive';
    END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM "_used_archive_slug" WHERE slug = candidate) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    INSERT INTO "_used_archive_slug" (slug) VALUES (candidate);
    UPDATE "archives" SET "slug" = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "archives" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "archives_slug_key" ON "archives"("slug");

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CONTENT_PUBLISHED');

-- CreateEnum
CREATE TYPE "NotificationEntityType" AS ENUM ('POST', 'EVENT', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_type_channel_key"
  ON "notification_preferences"("user_id", "type", "channel");

-- AddForeignKey
ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "entity_type" "NotificationEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link_path" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "last_error" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_type_entity_type_entity_id_key"
  ON "notifications"("user_id", "type", "entity_type", "entity_id");

CREATE INDEX "notifications_status_scheduled_at_idx"
  ON "notifications"("status", "scheduled_at");

CREATE INDEX "notifications_user_id_read_at_idx"
  ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
