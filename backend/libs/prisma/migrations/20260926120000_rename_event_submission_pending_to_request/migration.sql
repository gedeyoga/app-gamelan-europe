-- AlterEnum
ALTER TYPE "EventSubmissionStatus" RENAME VALUE 'PENDING' TO 'REQUEST';

-- AlterTable
ALTER TABLE "event_submissions" ALTER COLUMN "status" SET DEFAULT 'REQUEST';
