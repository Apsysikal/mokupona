-- Cloudinary migration phase 3: drop the legacy `Image.blob` column. Every row
-- was backfilled to a provider `storageKey` in phase 2 and both envs have been
-- serving CDN files since; image bytes no longer live in SQLite.
--
-- The rebuild below leaves the freed blob pages inside the database file — run
-- `VACUUM` afterwards to hand them back to the filesystem (see
-- docs/cloudinary-migration/rollout.md).

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT,
    "version" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "boardMemberId" TEXT,
    "eventId" TEXT,
    CONSTRAINT "Image_boardMemberId_fkey" FOREIGN KEY ("boardMemberId") REFERENCES "BoardMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Image" ("altText", "blurDataUrl", "boardMemberId", "contentType", "createdAt", "eventId", "height", "id", "storageKey", "updatedAt", "version", "width") SELECT "altText", "blurDataUrl", "boardMemberId", "contentType", "createdAt", "eventId", "height", "id", "storageKey", "updatedAt", "version", "width" FROM "Image";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
CREATE UNIQUE INDEX "Image_boardMemberId_key" ON "Image"("boardMemberId");
CREATE UNIQUE INDEX "Image_eventId_key" ON "Image"("eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
