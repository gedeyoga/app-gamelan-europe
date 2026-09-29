-- AlterTable: nested `author` section (data pengirim) on public event submissions.
-- Audit-only on the submission; never copied into the recreated Event on approve.
--
-- BREAKING (public API): `author` is now REQUIRED on `POST /event-submissions`.
-- External consumers (EGS website) that omit it now get 422.
--
-- Backfill: the table is NOT empty (1 legacy row exists). Required columns are added with a
-- temporary empty-string DEFAULT so existing rows backfill without dropping data, author_country_id
-- is seeded from the event's own country_id (oldest available geo), then the DEFAULTs are dropped
-- (the app always writes explicit values; author_state_id stays NULL for legacy rows).
ALTER TABLE "event_submissions"
    ADD COLUMN     "author_full_name" TEXT NOT NULL DEFAULT '',
    ADD COLUMN     "author_email" TEXT NOT NULL DEFAULT '',
    ADD COLUMN     "author_country_id" INTEGER,
    ADD COLUMN     "author_state_id" INTEGER;

UPDATE "event_submissions" SET "author_country_id" = "country_id" WHERE "author_country_id" IS NULL;

ALTER TABLE "event_submissions"
    ALTER COLUMN "author_full_name" DROP DEFAULT,
    ALTER COLUMN "author_email" DROP DEFAULT,
    ALTER COLUMN "author_country_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "event_submissions" ADD CONSTRAINT "event_submissions_author_country_id_fkey" FOREIGN KEY ("author_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_submissions" ADD CONSTRAINT "event_submissions_author_state_id_fkey" FOREIGN KEY ("author_state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
