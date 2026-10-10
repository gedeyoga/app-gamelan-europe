-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "duration_in_days" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "price" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "duration_in_days" DROP DEFAULT,
ALTER COLUMN "price" DROP DEFAULT;
