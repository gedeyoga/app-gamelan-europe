-- CreateEnum
CREATE TYPE "ContentVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "events" ADD COLUMN "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN "visibility" "ContentVisibility" NOT NULL DEFAULT 'PUBLIC';
