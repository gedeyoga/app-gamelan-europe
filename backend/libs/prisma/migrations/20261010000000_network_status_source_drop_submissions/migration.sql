-- CreateEnum
CREATE TYPE "NetworkStatus" AS ENUM ('DRAFT', 'REQUEST', 'APPROVED', 'PUBLISHED');

-- AlterTable
ALTER TABLE "networks" ADD COLUMN "status" "NetworkStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "networks" ADD COLUMN "source" "ContentSource" NOT NULL DEFAULT 'REGISTERED';
ALTER TABLE "networks" ADD COLUMN "published_at" TIMESTAMP(3);
ALTER TABLE "networks" ADD COLUMN "approved_at" TIMESTAMP(3);
ALTER TABLE "networks" ADD COLUMN "organisation_type" "NetworkOrganisationType";
ALTER TABLE "networks" ADD COLUMN "led_by" TEXT;
ALTER TABLE "networks" ADD COLUMN "maps_url" TEXT;
ALTER TABLE "networks" ADD COLUMN "activity_type" TEXT;
ALTER TABLE "networks" ADD COLUMN "country_id" INTEGER;
ALTER TABLE "networks" ADD COLUMN "state_id" INTEGER;
ALTER TABLE "networks" ADD COLUMN "created_by" TEXT;

-- CreateIndex
CREATE INDEX "networks_created_by_idx" ON "networks"("created_by");

-- AddForeignKey
ALTER TABLE "networks" ADD CONSTRAINT "networks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropTable
DROP TABLE "network_submissions";

-- DropEnum
DROP TYPE "NetworkSubmissionStatus";
