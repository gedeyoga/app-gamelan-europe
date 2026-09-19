-- AlterTable
ALTER TABLE "images" ADD COLUMN     "variants" JSONB,
ALTER COLUMN "entity_id" DROP NOT NULL,
ALTER COLUMN "order" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "images_key_key" ON "images"("key");
