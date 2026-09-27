-- CreateEnum
CREATE TYPE "EventSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "organization_id" TEXT;

-- CreateTable
CREATE TABLE "event_submissions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "country_id" INTEGER NOT NULL,
    "state_id" INTEGER,
    "organiser" TEXT NOT NULL,
    "event_type_id" TEXT,
    "short_description" TEXT NOT NULL,
    "thumbnail" TEXT,
    "status" "EventSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_submissions_event_id_key" ON "event_submissions"("event_id");

-- CreateIndex
CREATE INDEX "event_submissions_status_idx" ON "event_submissions"("status");

-- CreateIndex
CREATE INDEX "event_submissions_country_id_idx" ON "event_submissions"("country_id");

-- CreateIndex
CREATE INDEX "events_organization_id_idx" ON "events"("organization_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_submissions" ADD CONSTRAINT "event_submissions_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_submissions" ADD CONSTRAINT "event_submissions_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_submissions" ADD CONSTRAINT "event_submissions_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_submissions" ADD CONSTRAINT "event_submissions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
