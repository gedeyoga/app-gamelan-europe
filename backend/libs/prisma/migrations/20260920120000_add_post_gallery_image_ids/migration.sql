-- AlterTable
ALTER TABLE "posts" ADD COLUMN "gallery_image_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
