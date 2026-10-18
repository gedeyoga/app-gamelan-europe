-- Submitter identity for public submissions (no User row created)
ALTER TABLE "networks" ADD COLUMN "submitter_full_name" TEXT;
ALTER TABLE "networks" ADD COLUMN "submitter_email" TEXT;
ALTER TABLE "networks" ADD COLUMN "submitter_country" TEXT;
ALTER TABLE "networks" ADD COLUMN "submitter_state" TEXT;
