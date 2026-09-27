-- AlterTable: data-preserving backfill (content non-null untuk row existing).
ALTER TABLE "story_submissions" ADD COLUMN "category_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "story_submissions" ADD COLUMN "gallery_image_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "story_submissions" ADD COLUMN "flyer_image_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "story_submissions" ADD COLUMN "content" TEXT;
UPDATE "story_submissions" SET "content" = "short_description" WHERE "content" IS NULL;
ALTER TABLE "story_submissions" ALTER COLUMN "content" SET NOT NULL;
ALTER TABLE "story_submissions" DROP COLUMN "short_description";
