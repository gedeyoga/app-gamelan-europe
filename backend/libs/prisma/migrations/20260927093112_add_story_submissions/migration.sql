-- CreateEnum
CREATE TYPE "StorySubmissionStatus" AS ENUM ('REQUEST', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "story_submissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "thumbnail" TEXT,
    "status" "StorySubmissionStatus" NOT NULL DEFAULT 'REQUEST',
    "admin_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "story_submissions_post_id_key" ON "story_submissions"("post_id");

-- CreateIndex
CREATE INDEX "story_submissions_status_idx" ON "story_submissions"("status");

-- AddForeignKey
ALTER TABLE "story_submissions" ADD CONSTRAINT "story_submissions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
