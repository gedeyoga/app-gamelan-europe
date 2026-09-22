-- AlterTable
ALTER TABLE "posts" ADD COLUMN "flyer_image_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
