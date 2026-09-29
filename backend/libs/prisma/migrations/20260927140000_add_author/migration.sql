-- CreateTable
CREATE TABLE "authors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_authors" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_authors" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archive_authors" (
    "id" TEXT NOT NULL,
    "archive_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archive_authors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_authors_event_id_idx" ON "event_authors"("event_id");

-- CreateIndex
CREATE INDEX "event_authors_author_id_idx" ON "event_authors"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_authors_event_id_author_id_key" ON "event_authors"("event_id", "author_id");

-- CreateIndex
CREATE INDEX "post_authors_post_id_idx" ON "post_authors"("post_id");

-- CreateIndex
CREATE INDEX "post_authors_author_id_idx" ON "post_authors"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_authors_post_id_author_id_key" ON "post_authors"("post_id", "author_id");

-- CreateIndex
CREATE INDEX "archive_authors_archive_id_idx" ON "archive_authors"("archive_id");

-- CreateIndex
CREATE INDEX "archive_authors_author_id_idx" ON "archive_authors"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "archive_authors_archive_id_author_id_key" ON "archive_authors"("archive_id", "author_id");

-- AddForeignKey
ALTER TABLE "event_authors" ADD CONSTRAINT "event_authors_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_authors" ADD CONSTRAINT "event_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_authors" ADD CONSTRAINT "archive_authors_archive_id_fkey" FOREIGN KEY ("archive_id") REFERENCES "archives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_authors" ADD CONSTRAINT "archive_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
