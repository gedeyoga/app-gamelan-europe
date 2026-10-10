-- DropTable
DROP TABLE "archive_submissions";

-- DropEnum
DROP TYPE "ArchiveSubmissionStatus";

-- AlterTable
ALTER TABLE "archives" ADD COLUMN "source" "ContentSource" NOT NULL DEFAULT 'REGISTERED';
ALTER TABLE "archives" ADD COLUMN "date" TIMESTAMP(3);
ALTER TABLE "archives" ADD COLUMN "author" TEXT;
ALTER TABLE "archives" ADD COLUMN "organisation" TEXT;
ALTER TABLE "archives" ADD COLUMN "country_id" INTEGER;
ALTER TABLE "archives" ADD COLUMN "state_id" INTEGER;
ALTER TABLE "archives" ADD COLUMN "material_type" "ArchiveMaterialType";
