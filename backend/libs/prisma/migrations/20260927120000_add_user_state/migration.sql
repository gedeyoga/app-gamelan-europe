-- AlterTable
ALTER TABLE "users" ADD COLUMN     "state_id" INTEGER;

-- CreateIndex
CREATE INDEX "users_state_id_idx" ON "users"("state_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
