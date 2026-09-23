-- AlterEnum
-- Nilai enum disisipkan sebelum PUBLISHED agar urutan tetap DRAFT, REQUEST, APPROVED, PUBLISHED.
ALTER TYPE "ArchiveStatus" ADD VALUE 'REQUEST' BEFORE 'PUBLISHED';

-- AlterEnum
ALTER TYPE "ArchiveStatus" ADD VALUE 'APPROVED' BEFORE 'PUBLISHED';

-- AlterTable
ALTER TABLE "archives" ADD COLUMN "approved_at" TIMESTAMP(3);
