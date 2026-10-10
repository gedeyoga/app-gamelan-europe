-- CreateEnum
CREATE TYPE "ArchiveMaterialType" AS ENUM ('TUTORIALS', 'DOCUMENTARIES', 'RESEARCH', 'DOCUMENTS', 'HISTORY');

-- CreateEnum
CREATE TYPE "NetworkSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NetworkOrganisationType" AS ENUM ('GAMELAN_GROUP', 'ASSOCIATION', 'INSTITUTION');

-- AlterEnum
ALTER TYPE "EventEntry" ADD VALUE 'RESERVATION';

-- AlterTable
ALTER TABLE "archive_submissions" ADD COLUMN     "author" TEXT,
ADD COLUMN     "country_id" INTEGER,
ADD COLUMN     "date" TEXT,
ADD COLUMN     "material_type" "ArchiveMaterialType",
ADD COLUMN     "organisation" TEXT,
ADD COLUMN     "state_id" INTEGER,
ADD COLUMN     "submitter" JSONB;

-- AlterTable
ALTER TABLE "event_locations" ADD COLUMN     "maps_url" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "website_url" TEXT;

-- CreateTable
CREATE TABLE "network_submissions" (
    "id" TEXT NOT NULL,
    "organisation_type" "NetworkOrganisationType" NOT NULL,
    "name" TEXT NOT NULL,
    "led_by" TEXT,
    "country_id" INTEGER NOT NULL,
    "state_id" INTEGER,
    "address" TEXT,
    "maps_url" TEXT,
    "website" TEXT,
    "contact" TEXT NOT NULL,
    "social_media" JSONB,
    "activity_type" TEXT,
    "content" TEXT NOT NULL,
    "submitter" JSONB NOT NULL,
    "status" "NetworkSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "network_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "network_submissions_network_id_key" ON "network_submissions"("network_id");

-- CreateIndex
CREATE INDEX "network_submissions_status_idx" ON "network_submissions"("status");

-- AddForeignKey
ALTER TABLE "network_submissions" ADD CONSTRAINT "network_submissions_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

