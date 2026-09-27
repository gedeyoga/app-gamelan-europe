-- CreateEnum
CREATE TYPE "ArchiveSubmissionStatus" AS ENUM ('REQUEST', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "archive_submissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "external_links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachment_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ArchiveSubmissionStatus" NOT NULL DEFAULT 'REQUEST',
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "archive_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archive_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archive_submissions_archive_id_key" ON "archive_submissions"("archive_id");

-- CreateIndex
CREATE INDEX "archive_submissions_status_idx" ON "archive_submissions"("status");

-- AddForeignKey
ALTER TABLE "archive_submissions" ADD CONSTRAINT "archive_submissions_archive_id_fkey" FOREIGN KEY ("archive_id") REFERENCES "archives"("id") ON DELETE SET NULL ON UPDATE CASCADE;
