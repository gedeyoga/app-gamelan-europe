ALTER TABLE "networks" ADD COLUMN "city_id" INTEGER;
CREATE INDEX "networks_city_id_idx" ON "networks"("city_id");
ALTER TABLE "networks" ADD CONSTRAINT "networks_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
