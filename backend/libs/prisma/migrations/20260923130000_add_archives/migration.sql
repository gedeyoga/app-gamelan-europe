-- CreateEnum
CREATE TYPE "ArchiveType" AS ENUM ('MEMBER', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ArchiveStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "archives" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "type" "ArchiveType" NOT NULL DEFAULT 'PUBLIC',
    "status" "ArchiveStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "external_links" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "document_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archive_categories" (
    "id" TEXT NOT NULL,
    "archive_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archive_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "archives_created_by_idx" ON "archives"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "archive_categories_archive_id_category_id_key" ON "archive_categories"("archive_id", "category_id");

-- CreateIndex
CREATE INDEX "archive_categories_archive_id_idx" ON "archive_categories"("archive_id");

-- CreateIndex
CREATE INDEX "archive_categories_category_id_idx" ON "archive_categories"("category_id");

-- AddForeignKey
ALTER TABLE "archives" ADD CONSTRAINT "archives_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_categories" ADD CONSTRAINT "archive_categories_archive_id_fkey" FOREIGN KEY ("archive_id") REFERENCES "archives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_categories" ADD CONSTRAINT "archive_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
