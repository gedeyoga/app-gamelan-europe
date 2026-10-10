-- AlterEnum
ALTER TYPE "NetworkSubmissionStatus" RENAME VALUE 'PENDING' TO 'REQUEST';

-- AlterTable
ALTER TABLE "network_submissions" ALTER COLUMN "status" SET DEFAULT 'REQUEST';
