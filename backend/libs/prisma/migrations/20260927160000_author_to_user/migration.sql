-- DropForeignKey
ALTER TABLE "archive_authors" DROP CONSTRAINT "archive_authors_author_id_fkey";

-- DropForeignKey
ALTER TABLE "event_authors" DROP CONSTRAINT "event_authors_author_id_fkey";

-- DropForeignKey
ALTER TABLE "post_authors" DROP CONSTRAINT "post_authors_author_id_fkey";

-- DropTable
DROP TABLE "authors";

-- AddForeignKey
ALTER TABLE "event_authors" ADD CONSTRAINT "event_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_authors" ADD CONSTRAINT "archive_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
