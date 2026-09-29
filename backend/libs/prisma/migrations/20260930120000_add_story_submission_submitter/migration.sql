-- AlterTable: nested `submitter` section (data pengirim) on public story submissions.
-- Audit-only on the submission; never copied into the recreated Post on approve.
--
-- BREAKING (public API): `submitter` (with `submitter.countryId`) is now REQUIRED on
-- `POST /story-submissions`. External consumers (EGS website) that omit it now get 422.
--
-- Backfill: `story_submissions` may contain legacy rows. The required string columns are added
-- with a temporary empty-string DEFAULT so existing rows backfill without dropping data.
-- `story_submissions` carries no geo of its own, so legacy rows keep `submitter_country_id` /
-- `submitter_state_id` as NULL (no fabricated value: `countries` is seeded AFTER `migrate
-- deploy`, so a `(SELECT MIN(id) FROM countries)` backfill could be NULL and abort the
-- migration). The DEFAULTs are then dropped; the app always writes explicit values on create.
ALTER TABLE "story_submissions"
    ADD COLUMN     "submitter_full_name" TEXT NOT NULL DEFAULT '',
    ADD COLUMN     "submitter_email" TEXT NOT NULL DEFAULT '',
    ADD COLUMN     "submitter_country_id" INTEGER,
    ADD COLUMN     "submitter_state_id" INTEGER;

ALTER TABLE "story_submissions"
    ALTER COLUMN "submitter_full_name" DROP DEFAULT,
    ALTER COLUMN "submitter_email" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "story_submissions" ADD CONSTRAINT "story_submissions_submitter_country_id_fkey" FOREIGN KEY ("submitter_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_submissions" ADD CONSTRAINT "story_submissions_submitter_state_id_fkey" FOREIGN KEY ("submitter_state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
