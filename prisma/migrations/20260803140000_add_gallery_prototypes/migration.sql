-- Gallery prototypes: three competing foundations, side by side, so they can
-- be compared in the running app. Additive only — no existing column changes
-- meaning, so dropping the two losing foundations is a pure DROP TABLE /
-- DROP COLUMN follow-up.
--   A "tagged" — Image.galleryEventId (+ caption/position on the row)
--   B "join"   — EventGalleryEntry
--   C "album"  — Album

CREATE TABLE "EventGalleryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    CONSTRAINT "EventGalleryEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventGalleryEntry_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" TEXT,
    CONSTRAINT "Album_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "version" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "boardMemberId" TEXT,
    "eventId" TEXT,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "galleryEventId" TEXT,
    "albumId" TEXT,
    CONSTRAINT "Image_boardMemberId_fkey" FOREIGN KEY ("boardMemberId") REFERENCES "BoardMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_galleryEventId_fkey" FOREIGN KEY ("galleryEventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Image" ("altText", "blurDataUrl", "boardMemberId", "contentType", "createdAt", "eventId", "height", "id", "storageKey", "updatedAt", "version", "width") SELECT "altText", "blurDataUrl", "boardMemberId", "contentType", "createdAt", "eventId", "height", "id", "storageKey", "updatedAt", "version", "width" FROM "Image";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
CREATE UNIQUE INDEX "Image_boardMemberId_key" ON "Image"("boardMemberId");
CREATE UNIQUE INDEX "Image_eventId_key" ON "Image"("eventId");
CREATE INDEX "Image_galleryEventId_idx" ON "Image"("galleryEventId");
CREATE INDEX "Image_albumId_idx" ON "Image"("albumId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EventGalleryEntry_eventId_idx" ON "EventGalleryEntry"("eventId");

-- CreateIndex
CREATE INDEX "EventGalleryEntry_imageId_idx" ON "EventGalleryEntry"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "EventGalleryEntry_eventId_imageId_key" ON "EventGalleryEntry"("eventId", "imageId");

-- CreateIndex
CREATE UNIQUE INDEX "Album_eventId_key" ON "Album"("eventId");

