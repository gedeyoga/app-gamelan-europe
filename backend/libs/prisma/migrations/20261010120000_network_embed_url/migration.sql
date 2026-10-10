-- Add embed URL column
ALTER TABLE "networks" ADD COLUMN "embed_url" TEXT;

-- Backfill coordinates from maps_url when missing (prefer !3d!4d pin, else @lat,lng viewport)
UPDATE "networks"
SET "lat" = COALESCE(
      (regexp_match("maps_url", '!3d(-?[0-9]+(?:\.[0-9]+)?)!4d(-?[0-9]+(?:\.[0-9]+)?)'))[1]::numeric,
      (regexp_match("maps_url", '@(-?[0-9]+(?:\.[0-9]+)?),(-?[0-9]+(?:\.[0-9]+)?)'))[1]::numeric
    ),
    "lng" = COALESCE(
      (regexp_match("maps_url", '!3d(-?[0-9]+(?:\.[0-9]+)?)!4d(-?[0-9]+(?:\.[0-9]+)?)'))[2]::numeric,
      (regexp_match("maps_url", '@(-?[0-9]+(?:\.[0-9]+)?),(-?[0-9]+(?:\.[0-9]+)?)'))[2]::numeric
    )
WHERE "lat" IS NULL AND "lng" IS NULL AND "maps_url" IS NOT NULL
  AND "maps_url" ~ '(!3d-?[0-9]+(\.[0-9]+)?!4d-?[0-9]+(\.[0-9]+)?|@-?[0-9]+(\.[0-9]+)?,-?[0-9]+(\.[0-9]+)?)';

-- Backfill embed URL from coordinates
UPDATE "networks"
SET "embed_url" = 'https://www.google.com/maps?q=' || "lat" || ',' || "lng" || '&z=15&hl=en&output=embed'
WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL AND "embed_url" IS NULL;
