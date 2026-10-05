-- Konten publik langsung ditulis ke `posts`/`events`; `source` membedakan submit anonim
-- (PUBLIC) dari pembuatan oleh user login (REGISTERED). Tabel usulan dihapus.

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('PUBLIC', 'REGISTERED');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN "source" "ContentSource" NOT NULL DEFAULT 'REGISTERED';
ALTER TABLE "events" ADD COLUMN "source" "ContentSource" NOT NULL DEFAULT 'REGISTERED';

-- DropTable
DROP TABLE "story_submissions";
DROP TABLE "event_submissions";

-- DropEnum
DROP TYPE "StorySubmissionStatus";
DROP TYPE "EventSubmissionStatus";

-- Bersihkan permission usulan yang kini yatim. Link role/api-key ikut terhapus
-- via FK `onDelete: Cascade` (role_permissions, api_key_permissions).
DELETE FROM "permissions" WHERE "code" LIKE 'story-submission:%' OR "code" LIKE 'event-submission:%';
