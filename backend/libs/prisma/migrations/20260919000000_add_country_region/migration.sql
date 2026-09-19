-- AlterTable
ALTER TABLE "users" ADD COLUMN "country_id" TEXT;

-- CreateTable
CREATE TABLE "regions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "translations" JSONB,
    "wiki_data_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "iso2" CHAR(2) NOT NULL,
    "iso3" CHAR(3),
    "numeric_code" TEXT,
    "phone_code" TEXT,
    "capital" TEXT,
    "currency" TEXT,
    "currency_name" TEXT,
    "currency_symbol" TEXT,
    "tld" TEXT,
    "native" TEXT,
    "population" BIGINT,
    "gdp" BIGINT,
    "region_name" TEXT,
    "subregion" TEXT,
    "nationality" TEXT,
    "timezones" JSONB,
    "translations" JSONB,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "emoji" TEXT,
    "emoji_u" TEXT,
    "wiki_data_id" TEXT,
    "region_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

-- CreateIndex
CREATE INDEX "countries_region_id_idx" ON "countries"("region_id");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("iso2") ON DELETE SET NULL ON UPDATE CASCADE;
