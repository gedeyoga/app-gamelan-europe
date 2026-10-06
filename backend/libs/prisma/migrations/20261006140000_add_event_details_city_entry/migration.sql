-- CreateEnum
CREATE TYPE "EventEntry" AS ENUM ('FREE', 'TICKET');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "entry" "EventEntry" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "event_locations" ADD COLUMN     "city_id" INTEGER,
ADD COLUMN     "country_id" INTEGER,
ADD COLUMN     "state_id" INTEGER;

-- CreateTable
CREATE TABLE "cities" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "country_id" INTEGER NOT NULL,
    "state_id" INTEGER,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "wiki_data_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cities_country_id_idx" ON "cities"("country_id");

-- CreateIndex
CREATE INDEX "cities_state_id_idx" ON "cities"("state_id");

-- CreateIndex
CREATE INDEX "event_locations_country_id_idx" ON "event_locations"("country_id");

-- CreateIndex
CREATE INDEX "event_locations_state_id_idx" ON "event_locations"("state_id");

-- CreateIndex
CREATE INDEX "event_locations_city_id_idx" ON "event_locations"("city_id");

-- AddForeignKey
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
