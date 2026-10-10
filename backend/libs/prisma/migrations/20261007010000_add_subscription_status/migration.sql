-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE';
