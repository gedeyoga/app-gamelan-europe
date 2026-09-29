-- AlterTable
ALTER TABLE "images" ADD COLUMN     "created_by" TEXT;

-- CreateIndex
CREATE INDEX "images_entity_type_entity_id_created_by_idx" ON "images"("entity_type", "entity_id", "created_by");
