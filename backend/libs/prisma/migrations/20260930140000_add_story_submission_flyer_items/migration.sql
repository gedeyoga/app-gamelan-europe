-- StorySubmission.flyer: satu daftar gambar (`flyer_image_ids`) → daftar grup bertipe (`flyer_items`).
-- Bentuk `flyer_items`: [{"type": string, "imageIds": string[]}], urutan array = urutan grup.
-- `type` = id stabil `flyer` (sama dengan konversi `posts.flyer_items`), bukan label terjemahan.

ALTER TABLE "story_submissions" ADD COLUMN "flyer_items" JSONB NOT NULL DEFAULT '[]';

-- Konversi data lama: id flyer non-kosong → satu grup bertipe "flyer".
UPDATE "story_submissions"
SET "flyer_items" = jsonb_build_array(
  jsonb_build_object('type', 'flyer', 'imageIds', to_jsonb("flyer_image_ids"))
)
WHERE cardinality("flyer_image_ids") > 0;

ALTER TABLE "story_submissions" DROP COLUMN "flyer_image_ids";
